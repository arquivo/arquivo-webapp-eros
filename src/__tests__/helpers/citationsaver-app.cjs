'use strict';

// Shared setup for the Citation Saver suites that go through the real app (#177).
// A .cjs file, so Jest does not run it as a test suite.

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

// Fail fast instead of hanging Jest if a request never gets a response
const REQUEST_TIMEOUT_MS = 5000;

const messages = {
    empty: 'Nenhum documento foi submetido.',
    missing: 'O ficheiro não foi transferido, nenhum ficheiro foi submetido.',
    mimetype: 'O ficheiro não foi transferido. O formato do documento tem de ser PDF ou TXT.',
    filesize: 'O ficheiro não foi transferido. A dimensão do documento não pode exceder os 100 MB.',
    textFilesize: 'O texto não foi submetido. A dimensão do texto não pode exceder os 100 MB.',
    default: 'Algo correu mal, por favor tente novamente mais tarde.',
};

// A new temporary folder with the upload folders laid out as in production. The
// temporary upload folder is the default one, next to the upload folder.
function makeUploadFolders(prefix) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    return {
        root,
        uploadFolder: path.join(root, 'uploads', 'CitationSaver'),
        uploadTempFolder: path.join(root, 'uploads', '.citationsaver-tmp'),
    };
}

// Every file under `folder`, at any depth.
function filesUnder(folder) {
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder, { recursive: true })
        .filter(name => fs.statSync(path.join(folder, name)).isFile());
}

function post(app) {
    return request(app).post('/services/citationsaver').timeout(REQUEST_TIMEOUT_MS);
}

// The translations load asynchronously once the app is created. Until then the replies
// carry untranslated messages, so wait for them before the first test.
async function translationsLoaded(app) {
    for (let i = 0; i < 100; i++) {
        const res = await request(app).get('/services/citationsaver').timeout(REQUEST_TIMEOUT_MS);
        if (res.text.includes('Formatos aceites')) return;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('The translations did not load');
}

module.exports = { REQUEST_TIMEOUT_MS, messages, makeUploadFolders, filesUnder, post, translationsLoaded };
