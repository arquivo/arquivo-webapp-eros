
const config = require('config');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const googleSheetId = config.get('citation.saver.google.sheet.id');
const serviceAccountConfigs = require('../config/service_account.json');
const logger = require('./logger')('CitationSaver');

// Initialize the sheet - doc ID is the long id in the sheets URL
async function addToSpreadsheet(row){
  const doc = new GoogleSpreadsheet(googleSheetId);
  await doc.useServiceAccountAuth(serviceAccountConfigs);
  
  
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await sheet.addRow(row);
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

            
            let uploadedFile = req.files.file;
            const outExtension = mimeToExtension[uploadedFile.mimetype];

            if(!outExtension) {
                throw new Error("Invalid MIME type");
            }

            const newName = (Math.random() + 1).toString(36).substring(2) + '.' + outExtension;


            const date = (new Date()).toLocaleDateString('en-CA');
            const timestamp = Date.now();
            const email = req.body.email ?? '';
            const path = './uploads/CitationSaver/' + newName;
            const originalName = uploadedFile.name;
            //Use the name of the input field (i.e. "testFile") to retrieve the uploaded file
            
            //Use the mv() method to place the file in upload directory (i.e. "uploads")
            uploadedFile.mv(path);
            logger.info('File saved: '+ newName + '\tEmail: ' + email + '\tOriginal name: ' +  originalName);

            // Date	
            // Timestamp	
            // Email User	
            // Type of Submission	
            // PDF Original Name from User	
            // File Name CitationSaver System	
            // PDF Path CitationSaver System	
            // Results URLs without check	
            // Results URLs with check	
            // Results URLs File Path	
            // Note/Error
            addToSpreadsheet([date,timestamp,email,'File',originalName,newName,path]);

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
