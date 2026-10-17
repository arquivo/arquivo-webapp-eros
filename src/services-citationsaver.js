/**
 * Citation Saver Service
 *
 * Handles user submissions of citations/references in three formats:
 * 1. File uploads (PDF, TXT, HTML) - validates, stores with random filename
 * 2. URLs - validates accessibility, creates .link file with URL content
 * 3. Plain text - saves as .txt file
 *
 * All submissions are:
 * - Validated for type and size constraints
 * - Stored in configured upload folder with random names (the folder is created if missing)
 * - Logged to Google Spreadsheet for administrative tracking, only after the file is on disk
 *
 * A failed write or move replies { status: false } and never crashes the process.
 *
 * Each entry includes: date, timestamp, email, type, original name, filename, path
 *
 * Response format: { status: boolean, message: string, data?: object }
 *
 * Multipart bodies are parsed only for this POST, by parseUpload (#177). Uploads
 * stream into a temporary file and are cut off at citation.saver.max.upload.size.
 * The page sends a text as a file part too, so the other fields stay small.
 * An uploaded file is stored only if its bytes match its declared mimetype.
 */

const fetch = require('node-fetch');
const dns = require('node:dns');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const nodePath = require('node:path');
const config = require('config');
const fileUpload = require('express-fileupload');
const { rateLimit } = require('express-rate-limit');
const isValidUrl = require('./utils/is-valid-url');
const fs = require('fs');
const addToSpreadsheet = require('./spreadsheet-client');
const logger = require('./logger')('CitationSaver');

// busboy ignores a fileSize limit that is not a number, so fail at startup instead.
// Values from config/default.properties and environment variables are strings.
function numberSetting(key, { allowZero = false } = {}) {
    const value = Number(config.get(key));
    if (!Number.isFinite(value) || value < 0 || (value === 0 && !allowZero)) {
        throw new Error('Configuration property "' + key + '" must be a '
            + (allowZero ? 'non-negative' : 'positive') + ' number');
    }
    return value;
}

const maxUploadSize = numberSetting('citation.saver.max.upload.size');
const uploadFolderPath = config.get('citation.saver.upload.folder.path');
// Uploads in progress. Empty means ".citationsaver-tmp" next to the upload folder: it is
// on the same (writable) volume, so storing an upload is a rename, and it is not inside
// the upload folder, so it is never taken for a submission.
const uploadTempFolderPath = config.get('citation.saver.upload.temp.folder.path')
    || nodePath.join(nodePath.dirname(uploadFolderPath), '.citationsaver-tmp');
const tempFolderInUploadFolder = nodePath.relative(nodePath.resolve(uploadFolderPath), nodePath.resolve(uploadTempFolderPath));
if (!nodePath.isAbsolute(tempFolderInUploadFolder) && tempFolderInUploadFolder !== '..'
    && !tempFolderInUploadFolder.startsWith('..' + nodePath.sep)) {
    // Its partial uploads would be taken for submissions.
    throw new Error('Configuration property "citation.saver.upload.temp.folder.path" must not be '
        + 'inside "citation.saver.upload.folder.path" (' + uploadFolderPath + ')');
}

// busboy cuts every multipart field at this size (a file part has the upload limit).
// The same as express.urlencoded's default limit for a whole body, so a text field
// longer than this can only be one that was cut short.
const MAX_FIELD_BYTES = 100 * 1024;
// Fields that go into the logs and the Sheet row: checked before anything is logged.
const FIELD_LENGTH_LIMITS = [
    ['email', 254, 'services-citation-saver.errors.email.invalid'],
    ['url', 8192, 'services-citation-saver.errors.URL.invalid'],
];


function isPrivateIpv4(ip) {
    const [a, b] = ip.split('.').map(Number);
    return a === 127
        || a === 10
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 169 && b === 254);
}

function isPrivateIpv6(ip) {
    if (ip === '::1') return true;
    const firstGroup = Number.parseInt(ip.split(':')[0] || '0', 16);
    return (firstGroup & 0xfe00) === 0xfc00 || (firstGroup & 0xffc0) === 0xfe80;
}

function isPrivateIp(ip) {
    const v4mapped = (ip.startsWith('::ffff:') || ip.startsWith('::FFFF:')) ? ip.slice(7) : null;
    if (v4mapped && net.isIPv4(v4mapped)) return isPrivateIpv4(v4mapped);
    if (net.isIPv4(ip)) return isPrivateIpv4(ip);
    if (net.isIPv6(ip)) return isPrivateIpv6(ip);
    return false;
}

function isSsrfTarget(urlString) {
    let parsedUrl;
    try {
        parsedUrl = new URL(urlString);
    } catch {
        return Promise.resolve(true);
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return Promise.resolve(true);
    }
    const hostname = parsedUrl.hostname;
    if (net.isIP(hostname)) {
        return Promise.resolve(isPrivateIp(hostname));
    }
    return new Promise((resolve) => {
        dns.lookup(hostname, { all: true }, (err, addresses) => {
            if (err) return resolve(true);
            resolve(addresses.some(a => isPrivateIp(a.address)));
        });
    });
}

const mimeToExtension = new Map([
    // ["application/msword", "doc"],
    ["application/pdf", "pdf"],
    ["text/plain", "txt"],
    ["text/html", "html"]
]);

const PDF_MAGIC = Buffer.from('%PDF-');
// PDF readers look for the header anywhere in the first 1024 bytes.
const PDF_HEADER_WINDOW = 1024;

/*
 * Checks the bytes against the declared mimetype, which is only what the client
 * claims (#177): a PDF must have "%PDF-" in its first 1024 bytes; a text or HTML file
 * must have no NUL byte, which rules out binaries but keeps any 8-bit encoding (e.g.
 * Windows-1252 or ISO-8859-1). The temporary file is read in chunks, never whole.
 */
async function contentMatchesMimetype(uploadedFile) {
    if (uploadedFile.mimetype === 'application/pdf') {
        const chunks = [];
        for await (const chunk of fs.createReadStream(uploadedFile.tempFilePath, { start: 0, end: PDF_HEADER_WINDOW - 1 })) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks).includes(PDF_MAGIC);
    }
    for await (const chunk of fs.createReadStream(uploadedFile.tempFilePath)) {
        if (chunk.includes(0)) {
            return false;
        }
    }
    return true;
}

// Extensions only come from mimeToExtension or literals, so the name can never contain "/".
function newUploadName(extension) {
    return randomUUID() + '.' + extension;
}

/*
 * Stores a submission at `path` using `write(path)`, which must return a Promise.
 * The upload folder is created first because nothing else guarantees it exists
 * (e.g. a fresh ./uploads volume). Resolves only once the file is on disk; on failure
 * removes any partial file and rethrows so the caller replies with unexpectedError().
 */
async function storeUpload(path, write) {
    await fs.promises.mkdir(uploadFolderPath, { recursive: true });
    try {
        await write(path);
    } catch (err) {
        await fs.promises.rm(path, { force: true })
            .catch(rmErr => logger.warn('Could not remove partial upload ' + path + ': ' + rmErr));
        throw err;
    }
}

/*
 * Optional per-IP limit on submissions (#177): each one stores a file and adds a Sheet
 * row, and a URL also costs an outbound HEAD request. Counted in memory, per process.
 * Off unless citation.saver.rate.limit.max is above 0. The key is req.ip: behind a
 * reverse proxy, express.trust.proxy must match the proxy hops, or every client
 * shares the proxy's address and bucket.
 */
const rateLimitMax = numberSetting('citation.saver.rate.limit.max', { allowZero: true });
const rateLimiter = rateLimitMax === 0 ? (req, res, next) => next() : rateLimit({
    windowMs: numberSetting('citation.saver.rate.limit.window.ms'),
    limit: rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.info('Blocking submission: too many submissions from the same client.');
        res.status(options.statusCode).send({
            status: false,
            message: req.t('services-citation-saver.errors.default')
        });
    },
});

const UPLOAD_IDLE_TIMEOUT_MS = 15000;
// Room for the multipart framing and the small form fields next to the file or text.
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/*
 * Parses a multipart body (#177). The file (or the text, which the page sends as a
 * file part) streams into a temporary file and the upload is cut off once it goes
 * over maxUploadSize: express-fileupload then replies 413 with responseOnLimit, closes
 * the connection and deletes the partial file. At most one file and 10 fields of
 * MAX_FIELD_BYTES are read, and the whole body may not go over maxUploadSize plus
 * MULTIPART_OVERHEAD_BYTES, e.g. with parts past the limit, which are skipped.
 *
 * Each request gets its own temporary folder, removed when the response is closed.
 * This covers every outcome: stored (the file was moved out), rejected, failed,
 * over the limit and aborted by the client. Only a crash can leave one behind.
 */
function parseUpload(req, res, next) {
    if (!req.is('multipart/form-data')) {
        next();
        return;
    }
    // A private folder (mode 0700) for this request.
    const tempDir = nodePath.join(uploadTempFolderPath, randomUUID());
    // Runs once the response is over, so a failure can only be logged.
    function removeTempDir() {
        fs.promises.rm(tempDir, { recursive: true, force: true })
            .catch(err => logger.warn('Could not remove temporary upload folder ' + tempDir + ': ' + err));
    }
    let closed = false;
    res.on('close', () => {
        closed = true;
        removeTempDir();
    });
    // Replies { status: false } JSON, unless the response is already under way.
    function reject(status, logMessage) {
        if (status >= 500) {
            logger.error(logMessage);
        } else {
            logger.info(logMessage);
        }
        if (res.headersSent) {
            res.destroy();
            return;
        }
        res.status(status).send({
            status: false,
            message: req.t('services-citation-saver.errors.default')
        });
    }

    function parse() {
        if (closed) {
            // The client went away while the folder was being created.
            removeTempDir();
            return;
        }
        // The 413 reply is sent with writeHead(), which keeps the headers already set.
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // express-fileupload does not say which part went over the limit: a file or a text.
        const responseOnLimit = JSON.stringify({
            status: false,
            message: req.t('services-citation-saver.errors.filesize')
        });
        const middleware = fileUpload({
            // busboy cuts a file or field off once it reaches this many bytes, so + 1
            // still accepts exactly the limit, as handleFile and handleText check.
            limits: { fileSize: maxUploadSize + 1, fieldSize: MAX_FIELD_BYTES + 1, files: 1, fields: 10, parts: 11 },
            abortOnLimit: true,
            responseOnLimit,
            useTempFiles: true,
            tempFileDir: tempDir,
            // A file that gets no data for this long is dropped, e.g. once the client is
            // gone. Its folder is already removed then, but the file is still open.
            uploadTimeout: UPLOAD_IDLE_TIMEOUT_MS,
        });
        // Counted from here on: the middleware pipes the request in this same tick.
        let received = 0;
        req.on('data', (chunk) => {
            received += chunk.length;
            if (received > maxUploadSize + MULTIPART_OVERHEAD_BYTES && !res.headersSent) {
                logger.info('Blocking submission: multipart body over the limit.');
                req.unpipe();
                res.writeHead(413, { Connection: 'close' });
                res.end(responseOnLimit);
            }
        });
        try {
            middleware(req, res, (err) => {
                // express-fileupload can call next() after the response is over, e.g. once
                // the parser is destroyed for a client that went away. Nothing to do then.
                if (res.writableEnded || res.destroyed) {
                    return;
                }
                if (err) {
                    // busboy fails on a body it cannot parse, e.g. a malformed part header.
                    // An error writing the temporary file is ours.
                    reject(err.syscall ? 500 : 400, 'Blocking submission: could not read the multipart request. ' + err);
                    return;
                }
                next();
            });
        } catch (err) {
            // busboy throws at once for a Content-Type it cannot parse, e.g. one without
            // a boundary. Uncaught here, it would be an unhandled rejection and end the process.
            reject(400, 'Blocking submission: unreadable multipart request. ' + err);
        }
    }

    fs.promises.mkdir(uploadTempFolderPath, { recursive: true })
        .then(() => fs.promises.mkdir(tempDir, { mode: 0o700 }))
        .then(parse)
        .catch((err) => {
            // E.g. the temporary folder cannot be created. Never let it end the process.
            reject(500, 'Could not parse the upload (temporary folder ' + uploadTempFolderPath + '): ' + err);
        });
}

// The first of the email and url fields that is not a string within its length limit.
function invalidField(req) {
    return FIELD_LENGTH_LIMITS.find(([name, maxLength]) => {
        const value = req.body?.[name];
        return value != null && (typeof value !== 'string' || value.length > maxLength);
    });
}

module.exports = async function citationSaver(req, res) {
    const rejectedField = invalidField(req);
    if (rejectedField) {
        // The value itself is never logged.
        const [name, maxLength, messageKey] = rejectedField;
        logger.info('Blocking submission: "' + name + '" is not a string of at most ' + maxLength + ' characters.');
        res.status(400).send({
            status: false,
            message: req.t(messageKey)
        });
        return;
    }
    try {
        if (req.body?.url) {
            await handleURL(req, res);
        } else if (req.body?.text || req.files?.text) {
            await handleText(req, res);
        } else if (req.body?.file || req.files) {
            await handleFile(req, res);
        } else {
            logger.info(loggerErrorMessage(req, res, 'Malformed form.', req.t('services-citation-saver.errors.empty')));
            res.send({
                status: false,
                message: req.t('services-citation-saver.errors.empty')
            });
            return;
        }
    } catch (err) {
        unexpectedError(req, res, err);
    }
}

function loggerErrorMessage(req, res, start, reason) {
    const maxLogEntryArrayLength = 30;
    const maxLogEntryStringLength = 250;
    const maxSanitizerDepth = 100;

    function stringifySanitizer(obj) {
        var i = 0;

        return function (k, v) {
            // Handle circular objects
            if (i !== 0 && typeof (obj) === 'object' && typeof (v) == 'object' && obj == v)
                return '[Circular]';

            // Limit the depth 
            if (i >= maxSanitizerDepth)
                return '[Unknown]';

            ++i; // so we know we aren't using the original object anymore

            // Truncate big strings
            if (typeof v == 'string' && v.length > maxLogEntryStringLength) {
                return v.substring(0, maxLogEntryStringLength / 2) + '[Truncated]' + v.substring(v.length - maxLogEntryStringLength / 2);
            }
            // Truncate big arrays
            if (typeof v == 'object' && Array.isArray(v) && v.length > maxLogEntryArrayLength) {
                return [...v.filter((x, i) => i <= maxLogEntryArrayLength / 2), '[Truncated]', ...v.filter((x, i) => i > v.length - maxLogEntryArrayLength / 2)];
            }
            return v;
        }
    }
    const reqData = { body: req.body, files: req.files };
    return start + ' Reason: ' + JSON.stringify(reason,stringifySanitizer(reason)) + ' Request data: ' + JSON.stringify(reqData, stringifySanitizer(reqData));
}

function unexpectedError(req, res, err) {
    // JSON.stringify only keeps an Error's enumerable fields (e.g. code), so add message and stack.
    const reason = err instanceof Error ? { ...err, message: err.message, stack: err.stack } : err;
    logger.error(loggerErrorMessage(req, res, 'Something unexpected occurred.', reason));
    // Don't reply twice: a second res.send() would throw ERR_HTTP_HEADERS_SENT. router.js
    // would pass that to Express's error handler, which cannot reply after headers are sent.
    if (res.headersSent) {
        return;
    }
    res.send({
        status: false,
        message: req.t('services-citation-saver.errors.default')
    });
}

async function handleFile(req, res) {

    function sendExpectedError(message) {
        logger.info(loggerErrorMessage(req, res, 'Blocking submitted file.', message));
        res.send({
            status: false,
            message: message
        });
    }
    // A file sent under another field name is treated as missing.
    const uploadedFile = req.files?.file;
    if (!uploadedFile) {
        sendExpectedError(req.t('services-citation-saver.errors.file.missing'));
        return;
    }

    const originalName = uploadedFile.name;
    const outExtension = mimeToExtension.get(uploadedFile.mimetype);

    if (!outExtension) {
        sendExpectedError(req.t('services-citation-saver.errors.file.mimetype'));
        return;
    }

    // parseUpload already cuts off a file over the limit; this is a second check.
    if (uploadedFile.truncated || uploadedFile.size > maxUploadSize) {
        sendExpectedError(req.t('services-citation-saver.errors.file.filesize'));
        return;
    }

    if (!(await contentMatchesMimetype(uploadedFile))) {
        sendExpectedError(req.t('services-citation-saver.errors.file.mimetype'));
        return;
    }

    const newName = newUploadName(outExtension);
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = uploadFolderPath + '/' + newName;

    // Without a callback, express-fileupload's mv() returns a Promise.
    await storeUpload(path, (target) => uploadedFile.mv(target));

    addToSpreadsheet([date, timestamp, email, 'File', originalName, newName, path])
        .then(() => {
            logger.info('File saved: ' + newName + '\tEmail: ' + email + '\tOriginal name: ' + originalName);
        }).catch(err => {
            logger.error('Failed to save file: ' + newName + '\tEmail: ' + email + '\tOriginal name: ' + originalName+ '\t Due to the following error: '+err);
        });

    res.send({
        status: true,
        message: 'File uploaded',
        data: {
            name: originalName,
            mimetype: uploadedFile.mimetype,
            size: uploadedFile.size
        }
    });

}
/*
 * Creates a .link file in the uploads folder which contains the submitted URL.
 */
async function handleURL(req, res) {

    function sendExpectedError(message) {
        logger.info(loggerErrorMessage(req, res, 'Blocking submitted URL.', message));
        res.send({
            status: false,
            message: message
        });
    }

    const url = req.body.url

    if (!isValidUrl(url)) {
        sendExpectedError(req.t('services-citation-saver.errors.URL.invalid'));
        return;
    }

    const startsWithHttp = /^https?:\/\//

    const fetchUrl = startsWithHttp.test(url.toLowerCase()) ? url : 'https://' + url;
    const fetchOptions = {
        method: 'HEAD',
        redirect: 'error'
    };

    // Any other failure (fetch, a missing content-type, the write) propagates to the
    // exported handler, which replies with unexpectedError().
    if (await isSsrfTarget(fetchUrl)) {
        sendExpectedError(req.t('services-citation-saver.errors.URL.invalid'));
        return;
    }

    const r = await fetch(fetchUrl, fetchOptions);

    if (!r.ok) {
        sendExpectedError(req.t('services-citation-saver.errors.URL.invalid'));
        return;
    }

    const mimetype = r.headers.get('content-type');
    const filesize = r.headers.get('content-length');

    if (!mimeToExtension.has(mimetype.split(';')[0])) {
        sendExpectedError(req.t('services-citation-saver.errors.URL.mimetype'));
        return;
    }

    if (Number(filesize) > maxUploadSize) {
        sendExpectedError(req.t('services-citation-saver.errors.URL.filesize'));
        return;
    }

    const outExtension = 'link';
    const newName = newUploadName(outExtension);
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = uploadFolderPath + '/' + newName;

    await storeUpload(path, (target) => fs.promises.writeFile(target, url));

    addToSpreadsheet([date, timestamp, email, 'Link', url, newName, path])
        .then(() => {
            logger.info('URL saved: ' + newName + '\tOriginal: ' + url + '\tEmail: ' + email);
        }).catch(e => {
            logger.error('FAILED to save URL: ' + newName + '\tOriginal: ' + url + '\tEmail: ' + email + '\t Due to the following error: ' + e);
        });

    res.send({
        status: true,
        message: 'Link uploaded',
        data: {
            name: url,
            mimetype: '',
            size: url.length
        }
    });
}

/*
 * Saves a text as a .txt file. public/js/citation-saver.js sends it as a file part
 * named "text", which streams to a temporary file under the upload limit. A text
 * field is still read: from an urlencoded form or a page loaded before that change.
 */
async function handleText(req, res) {

    function sendExpectedError(message) {
        logger.info(loggerErrorMessage(req, res, 'Blocking submitted text.', message));
        res.send({
            status: false,
            message: message
        });
    }

    const textFile = req.files?.text;
    const text = req.body?.text;
    let size;
    let write;
    if (textFile) {
        if (textFile.truncated || textFile.size > maxUploadSize) {
            sendExpectedError(req.t('services-citation-saver.errors.text.filesize'));
            return;
        }
        // As for an uploaded text file: no NUL byte.
        if (!(await contentMatchesMimetype({ mimetype: 'text/plain', tempFilePath: textFile.tempFilePath }))) {
            sendExpectedError(req.t('services-citation-saver.errors.default'));
            return;
        }
        size = textFile.size;
        write = (target) => textFile.mv(target);
    } else if (typeof text === 'string') {
        const bytes = Buffer.byteLength(text);
        if (bytes > maxUploadSize) {
            sendExpectedError(req.t('services-citation-saver.errors.text.filesize'));
            return;
        }
        // Possibly cut short by busboy: never store part of a text.
        if (bytes > MAX_FIELD_BYTES) {
            sendExpectedError(req.t('services-citation-saver.errors.default'));
            return;
        }
        size = text.length;
        write = (target) => fs.promises.writeFile(target, text);
    } else {
        // A field sent more than once arrives as an array, which fs.promises.writeFile
        // would join and store. Reject it with the default error reply instead.
        sendExpectedError(req.t('services-citation-saver.errors.default'));
        return;
    }

    const outExtension = 'txt';
    const newName = newUploadName(outExtension);
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = uploadFolderPath + '/' + newName;
    const originalName = '';

    await storeUpload(path, write);

    addToSpreadsheet([date, timestamp, email, 'Text', originalName, newName, path])
        .then(() => {
            logger.info('Text saved: ' + newName + '\tEmail: ' + email);
        }).catch(err => {
            logger.error('FAILED to save text: ' + newName + '\tEmail: ' + email + '\t Due to the following error: ' + err);
        });

    res.send({
        status: true,
        message: 'Text uploaded',
        data: {
            name: originalName,
            mimetype: 'text/plain',
            size: size
        }
    });
}
module.exports.rateLimiter = rateLimiter;
module.exports.parseUpload = parseUpload;
