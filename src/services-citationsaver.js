
const config = require('config');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const googleSheetId = config.get('citation.saver.google.sheet.id');
const serviceAccountConfigs = require('../config/service_account.json');
const logger = require('./logger')()

// Initialize the sheet - doc ID is the long id in the sheets URL
async function addToSpreadsheet(row){
  const doc = new GoogleSpreadsheet(googleSheetId);
  try {
  await doc.useServiceAccountAuth(serviceAccountConfigs);
  
  
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await sheet.addRow(row);
  } catch (e) {
        logger.error(e);
  }
}

const mimeToExtension = {
    "application/msword" : "doc",
    "application/pdf" : "pdf",
    "text/plain" : "txt"
}
module.exports = function (req, res) {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {

            
            let uploadedFile = req.files.testFile;
            const outExtension = mimeToExtension[uploadedFile.mimetype];

            if(!outExtension) {
                throw new Error("Invalid MIME type");
            }

            const newName = (Math.random() + 1).toString(36).substring(2) + outExtension;

            const timestamp = Date.now();
            const email = req.body.email ?? '';
            const path = './uploads/CitationSaver/' + newName;
            const originalName = uploadedFile.name;
            //Use the name of the input field (i.e. "testFile") to retrieve the uploaded file
            
            //Use the mv() method to place the file in upload directory (i.e. "uploads")
            uploadedFile.mv(path);

            
            addToSpreadsheet([timestamp,email,path,originalName]);

            //send response
            res.send({
                status: true,
                message: 'File is uploaded',
                data: {
                    name: uploadedFile.name,
                    mimetype: uploadedFile.mimetype,
                    size: uploadedFile.size
                }
            });
        }
    } catch (err) {
        logger.error(err);
        res.status(500).send(err);
    }

}
