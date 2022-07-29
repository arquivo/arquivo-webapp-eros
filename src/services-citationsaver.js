
const fetch = require('node-fetch');
const https = require('https');
const http = require('https');
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
    "application/msword": "doc",
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
            res.send({
                status: false,
                message: 'Malformed form.'
            });
            return;
        }
    } catch (err) {
        unexpectedError(res, err);
    }
}

function unexpectedError(res, err) {
    logger.error(err);
    res.status(500).send(err);
}

function handleFile(req, res) {

    if (!req.files) {
        res.send({
            status: false,
            message: 'No file uploaded'
        });
        return;
    }

    const uploadedFile = req.files.file;
    const originalName = uploadedFile.name;

    const outExtension = mimeToExtension[uploadedFile.mimetype];
    if (!outExtension) {
        res.send({
            status: false,
            message: 'Invalid MIME type'
        });
        return;
    }

    if (uploadedFile.size > maxUploadSize) {
        res.send({
            status: false,
            message: 'File exceeds maximum size'
        });
        return;
    }

    const newName = (Math.random() + 1).toString(36).substring(2) + '.' + outExtension;
    const date = (new Date()).toLocaleDateString('en-CA');
    const timestamp = Date.now();
    const email = req.body?.email ?? '';
    const path = './uploads/CitationSaver/' + newName;

    uploadedFile.mv(path);

    logger.info('File saved: ' + newName + '\tEmail: ' + email + '\tOriginal name: ' + originalName);

    addToSpreadsheet([date, timestamp, email, 'File', originalName, newName, path]);

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
 *  Downloads given url if mimetype is allowed, puts it in the uploads folder.
 */
function handleURL(req, res) {

    const url = req.body.url

    if (!isValidUrl(url)) {
        res.send({
            status: false,
            message: 'Invalid URL'
        });
        return;
    }
    let filename = (Math.random() + 1).toString(36).substring(2);
    let outExtension, newName, path, mimetype, filesize;

    let expectedError = false;

    const startsWithHttp = /^https?:\/\//
    const fetchUrl = startsWithHttp.test(url.toLowerCase()) ? url.toLowerCase() : 'https://' + url.toLowerCase();
    https.globalAgent = new https.Agent({
        rejectUnauthorized: false, // Ignore SSL errors, we're just using looking for URLs.
    });

    logger.info(fetchUrl + ' ' + fetchUrl.startsWith('https://') )
    fetch(fetchUrl)
        .then((r) => {
            function throwExpectedError(message) {
                expectedError = true;
                throw new Error(message);
            }

            if (!r.ok) {
                throwExpectedError('Could not access website: ' + url);
            }

            mimetype = r.headers.get('content-type');
            filesize = r.headers.get('content-length');
            outExtension = mimeToExtension[mimetype.split(';')[0]];
            if (!outExtension) {
                throwExpectedError('Invalid MIME type: ' + mimetype);
            }

            if (Number(filesize) > maxUploadSize) {
                throwExpectedError('File exceeds maximum size');
            }

            newName = filename + '.' + outExtension;
            path = './uploads/CitationSaver/' + newName;
            filesize = 0;
            return new Promise((resolve, reject) => {
                const dest = fs.createWriteStream(path);
                r.body.pipe(dest);
                r.body.on('data', (chunk) => {
                    filesize += chunk.length;
                    if (filesize > maxUploadSize) {
                        expectedError = true;
                        reject(new Error('File exceeds maximum size'));
                    }
                })
                    .on("end", () => {
                        resolve();
                    });
                dest.on("error", (err) => {
                    fs.unlink(path);
                    reject(err);
                });
            });
        }).then(() => {
            const date = (new Date()).toLocaleDateString('en-CA');
            const timestamp = Date.now();
            const email = req.body?.email ?? '';

            logger.info('URL saved: ' + newName + '\tEmail: ' + email + '\tOriginal name: ' + url);
            addToSpreadsheet([date, timestamp, email, 'URL', url, newName, path]);

            res.send({
                status: true,
                message: 'URL is uploaded',
                data: {
                    name: url,
                    mimetype: mimetype,
                    size: filesize
                }
            });
        })
        .catch((err) => {
            if (expectedError) {
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
        res.send({
            status: false,
            message: 'Text exceeds maximum size'
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

        logger.info('Text saved: ' + newName + '\tEmail: ' + email );
        addToSpreadsheet([date, timestamp, email, 'Link', originalName, newName, path]);
    });
}