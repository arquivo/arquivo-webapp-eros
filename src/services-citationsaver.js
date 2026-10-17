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
 */

const fetch = require('node-fetch');
const dns = require('node:dns');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const config = require('config');
const isValidUrl = require('./utils/is-valid-url');
const fs = require('fs');
const addToSpreadsheet = require('./spreadsheet-client');
const maxUploadSize = config.get('citation.saver.max.upload.size');
const uploadFolderPath = config.get('citation.saver.upload.folder.path');
const logger = require('./logger')('CitationSaver');


// The early check below gives a clear reply; ssrfSafeAgent enforces it on the connection.
const { BLOCKED_ADDRESS, isPrivateIp, ssrfSafeAgent } = require('./utils/ssrf-safe-agent');

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

module.exports = async function citationSaver(req, res) {
    try {
        if (req.body?.url) {
            await handleURL(req, res);
        } else if (req.body?.text) {
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
    if (!req.files) {
        sendExpectedError(req.t('services-citation-saver.errors.file.missing'));
        return;
    }

    const uploadedFile = req.files.file;
    const originalName = uploadedFile.name;
    const outExtension = mimeToExtension.get(uploadedFile.mimetype);

    if (!outExtension) {
        sendExpectedError(req.t('services-citation-saver.errors.file.mimetype'));
        return;
    }

    if (uploadedFile.size > maxUploadSize) {

        sendExpectedError(req.t('services-citation-saver.errors.file.filesize'));
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
        redirect: 'error',
        // Checks the address actually connected to, which may differ from the one
        // isSsrfTarget() saw if the name resolves differently the second time.
        agent: ssrfSafeAgent
    };

    // Any other failure (fetch, a missing content-type, the write) propagates to the
    // exported handler, which replies with unexpectedError().
    if (await isSsrfTarget(fetchUrl)) {
        sendExpectedError(req.t('services-citation-saver.errors.URL.invalid'));
        return;
    }

    let r;
    try {
        r = await fetch(fetchUrl, fetchOptions);
    } catch (err) {
        if (err.code !== BLOCKED_ADDRESS) throw err;
        sendExpectedError(req.t('services-citation-saver.errors.URL.invalid'));
        return;
    }

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

async function handleText(req, res) {
    const text = req.body.text;

    // A field sent more than once arrives as an array, which fs.promises.writeFile would
    // join and store. Reject it with the default error reply instead.
    if (typeof text !== 'string') {
        logger.info(loggerErrorMessage(req, res, 'Blocking submitted text.', 'text is not a string'));
        res.send({
            status: false,
            message: req.t('services-citation-saver.errors.default')
        });
        return;
    }

    if (text.length > maxUploadSize) {
        logger.info(loggerErrorMessage(req, res, 'Blocking submitted text.', req.t('services-citation-saver.errors.file.filesize')));
        res.send({
            status: false,
            message: req.t('services-citation-saver.errors.text.filesize')
        });
        return;
    }

    const outExtension = 'txt';
    const newName = newUploadName(outExtension);
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = uploadFolderPath + '/' + newName;
    const originalName = '';

    await storeUpload(path, (target) => fs.promises.writeFile(target, text));

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
            size: text.length
        }
    });
}