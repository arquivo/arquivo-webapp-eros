const { GoogleSpreadsheet } = require('google-spreadsheet');
const config = require('config');

const googleSheetId = config.get('citation.saver.google.sheet.id');
const serviceAccountConfigs = require('./config/service_account.json');

// Initialize the sheet - doc ID is the long id in the sheets URL
async function doStuff(){
  const doc = new GoogleSpreadsheet(googleSheetId);
  
  // Initialize Auth - see https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
  await doc.useServiceAccountAuth(serviceAccountConfigs);
  
  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);
  // await doc.updateProperties({ title: 'renamed doc' });
  
  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]

  await sheet.addRow(['ola pedro','from nodejs','Pog']);

  console.log(sheet.title);
  console.log(sheet.rowCount);
}

doStuff();