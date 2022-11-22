
const fetch = require('node-fetch');
const https = require('https');
const config = require('config');
const isValidUrl = require('./utils/is-valid-url');
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const googleSheetId = config.get('citation.saver.google.sheet.id');
const maxUploadSize = config.get('citation.saver.max.upload.size');
const serviceAccountConfigs = require('../config/service_account.json');
const logger = require('./logger')('CitationSaver');


// Initialize the sheet - doc ID is the long id in the sheets URL
async function addToSpreadsheet(row) {
    const doc = new GoogleSpreadsheet(googleSheetId);
    await doc.useServiceAccountAuth(serviceAccountConfigs)

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
    await sheet.addRow(row);
}

const mimeToExtension = {
    // "application/msword": "doc",
    "application/pdf": "pdf",
    "text/plain": "txt",
    // "text/html": "html"
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
            logger.error('Malformed form.');
            res.send({
                status: false,
                message: req.t('services-citation-saver.errors.default')
            });
            return;
        }
    } catch (err) {
        unexpectedError(res, err);
    }
}

function unexpectedError(res, err) {
    logger.error(err);
    res.send({
        status: false,
        message: req.t('services-citation-saver.errors.default')
    });
}

function handleFile(req, res) {

    if (!req.files) {
        res.send({
            status: false,
            message: req.t('services-citation-saver.errors.file.missing')
        });
        return;
    }

    const uploadedFile = req.files.file;
    const originalName = uploadedFile.name;

    const outExtension = mimeToExtension[uploadedFile.mimetype];
    if (!outExtension) {

        logger.error('Invalid MIME type');
        res.send({
            status: false,
            message: req.t('services-citation-saver.errors.file.mimetype')
        });
        return;
    }

    if (uploadedFile.size > maxUploadSize) {

        logger.error('File exceeds maximum size');
        res.send({
            status: false,
            message: req.t('services-citation-saver.errors.file.filesize')
        });
        return;
    }

    const newName = (Math.random() + 1).toString(36).substring(2) + '.' + outExtension;
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = './uploads/CitationSaver/' + newName;

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

    const url = req.body.url

    if (!isValidUrl(url)) {
        res.send({
            status: false,
            message: req.t('services-citation-saver.errors.URL.invalid')
        });
        return;
    }

    let expectedError = false;

    const startsWithHttp = /^https?:\/\//
    const fetchUrl = startsWithHttp.test(url.toLowerCase()) ? url.toLowerCase() : 'https://' + url.toLowerCase();
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
                logger.info('Blocking submitted URL: "' + url +'" Reason: "' + message + '"');
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
            const path = './uploads/CitationSaver/' + newName;

            fs.writeFile(path, url, err => {
                if (err) {
                    fs.unlink(path);
                    throw err;
                }
                res.send({
                    status: true,
                    message: 'Link uploaded',
                    data: {
                        name: url,
                        mimetype: '',
                        size: url.length
                    }
                });

                addToSpreadsheet([date, timestamp, email, 'Link', url, newName, path]);
                logger.info('URL saved: ' + newName + '\tOriginal: ' + url + '\tEmail: ' + email);
            });
        }).catch((err) => {
            if (expectedError) {
                logger.error(err.message);
                res.send({
                    status: false,
                    message: err.message
                })
            } else {
                unexpectedError(res, err);
            }
        });



}

function handleText(req, res) {
    const text = req.body.text;

    if (text.length > maxUploadSize) {
        logger.error(req.t('services-citation-saver.errors.file.filesize'))
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
    const path = './uploads/CitationSaver/' + newName;
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