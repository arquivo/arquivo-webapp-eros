
const fetch = require('node-fetch');
const https = require('https');
const config = require('config');
const isValidUrl = require('./utils/is-valid-url');
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const googleSheetId = config.get('citation.saver.google.sheet.id');
const maxUploadSize = config.get('citation.saver.max.upload.size');
const uploadFolderPath = config.get('citation.saver.upload.folder.path');
const serviceAccountConfigs = require('../config/service_account.json');
const logger = require('./logger')('CitationSaver');


// Initialize the sheet - doc ID is the long id in the sheets URL
async function addToSpreadsheet(row) {
    try {
        const doc = new GoogleSpreadsheet(googleSheetId);
        await doc.useServiceAccountAuth(serviceAccountConfigs)

        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
        await sheet.addRow(row);
    } catch (err) {
        logger.error('Failed to connect to google services. Reason: "'+ err + '". Data: '+JSON.stringify(row));
    }
    
}

const mimeToExtension = {
    // "application/msword": "doc",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/html": "html"
}
module.exports = function (req, res) {
    try {
        if (req.body?.url) {
            handleURL(req, res);
        } else if (req.body?.text) {
            handleText(req, res);
        } else if (req.body?.file || req.files) {
            handleFile(req, res);
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
    reqData = { body: req.body, files: req.files };
    return start + ' Reason: ' + JSON.stringify(reason,stringifySanitizer(reason)) + ' Request data: ' + JSON.stringify(reqData, stringifySanitizer(reqData));
}

function unexpectedError(req, res, err) {
    logger.error(loggerErrorMessage(req, res, 'Something unexpected occurred.', err));
    res.send({
        status: false,
        message: req.t('services-citation-saver.errors.default')
    });
}

function handleFile(req, res) {

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
    const outExtension = mimeToExtension[uploadedFile.mimetype];

    if (!outExtension) {
        sendExpectedError(req.t('services-citation-saver.errors.file.mimetype'));
        return;
    }

    if (uploadedFile.size > maxUploadSize) {

        sendExpectedError(req.t('services-citation-saver.errors.file.filesize'));
        return;
    }

    const newName = (Math.random() + 1).toString(36).substring(2) + '.' + outExtension;
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = uploadFolderPath + '/' + newName;

    uploadedFile.mv(path);


    addToSpreadsheet([date, timestamp, email, 'File', originalName, newName, path]);
    logger.info('File saved: ' + newName + '\tEmail: ' + email + '\tOriginal name: ' + originalName);

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
function handleURL(req, res) {

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

    let expectedError = false;

    const startsWithHttp = /^https?:\/\//

    const fetchUrl = startsWithHttp.test(url.toLowerCase()) ? url : 'https://' + url;
    const fetchOptions = {
        method: 'HEAD'
    };

    https.globalAgent = new https.Agent({
        rejectUnauthorized: false, // Ignore SSL errors, we're just using looking for URLs.
    });

    fetch(fetchUrl, fetchOptions)
        .then((r) => {
            function throwExpectedError(message) {
                expectedError = true;
                throw new Error(message);
            }

            if (!r.ok) {
                throwExpectedError(req.t('services-citation-saver.errors.URL.invalid'));
            }

            mimetype = r.headers.get('content-type');
            filesize = r.headers.get('content-length');

            if (!mimeToExtension[mimetype.split(';')[0]]) {
                throwExpectedError(req.t('services-citation-saver.errors.URL.mimetype'));
            }

            if (Number(filesize) > maxUploadSize) {
                throwExpectedError(req.t('services-citation-saver.errors.URL.filesize'));
            }

        }).then(() => {

            const outExtension = 'link';
            const newName = (Math.random() + 1).toString(36).substring(2) + '.' + outExtension;
            const date = (new Date()).toLocaleDateString('en-CA');
            const timestamp = Date.now();
            const email = req.body?.email ?? '';
            const path = uploadFolderPath + '/' + newName;

            fs.writeFile(path, url, err => {
                if (err) {
                    fs.unlink(path);
                    throw err;
                }

                addToSpreadsheet([date, timestamp, email, 'Link', url, newName, path]);
                logger.info('URL saved: ' + newName + '\tOriginal: ' + url + '\tEmail: ' + email);
                res.send({
                    status: true,
                    message: 'Link uploaded',
                    data: {
                        name: url,
                        mimetype: '',
                        size: url.length
                    }
                });

            });
        }).catch((err) => {
            if (expectedError) {
                sendExpectedError(err.message);
            } else {
                unexpectedError(req, res, err);
            }
        });



}

function handleText(req, res) {
    const text = req.body.text;

    if (text.length > maxUploadSize) {
        logger.info(loggerErrorMessage(req, res, 'Blocking submitted text.', req.t('services-citation-saver.errors.file.filesize')));
        res.send({
            status: false,
            message: req.t('services-citation-saver.errors.text.filesize')
        });
        return;
    }

    const outExtension = 'txt';
    const newName = (Math.random() + 1).toString(36).substring(2) + '.' + outExtension;
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = uploadFolderPath + '/' + newName;
    const originalName = '';

    fs.writeFile(path, text, err => {
        if (err) {
            fs.unlink(path);
            throw err;
        }
        res.send({
            status: true,
            message: 'Text uploaded',
            data: {
                name: originalName,
                mimetype: 'text/plain',
                size: text.length
            }
        });

        addToSpreadsheet([date, timestamp, email, 'Text', originalName, newName, path]);
        logger.info('Text saved: ' + newName + '\tEmail: ' + email);
    });
}