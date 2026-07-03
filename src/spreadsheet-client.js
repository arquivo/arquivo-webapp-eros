'use strict';

const config = require('config');
const googleSheetId = config.get('citation.saver.google.sheet.id');
const serviceAccountConfigs = require('../config/service_account.json');
const logger = require('./logger')('CitationSaver');

// google-spreadsheet v5+ is ESM-only; _importDeps is extracted so tests can stub it
async function addToSpreadsheet(row) {
    try {
        const { GoogleSpreadsheet, JWT } = await module.exports._importDeps();
        const auth = new JWT({
            email: serviceAccountConfigs.client_email,
            key: serviceAccountConfigs.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const doc = new GoogleSpreadsheet(googleSheetId, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow(row);
    } catch (err) {
        logger.error('Failed to connect to google services. Reason: "' + err + '". Data: ' + JSON.stringify(row));
    }
}

module.exports = addToSpreadsheet;
module.exports._importDeps = async function () {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    return { GoogleSpreadsheet, JWT };
};
