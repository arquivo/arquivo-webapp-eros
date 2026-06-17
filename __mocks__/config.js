// Mock config module for Jest tests
const mockConfig = {
  'backend.url': 'https://preprod.arquivo.pt',
  'wayback.url': 'https://preprod.arquivo.pt/wayback',
  'pywb.url': 'https://preprod.arquivo.pt/noFrame/replay',
  'screenshot.url': 'https://preprod.arquivo.pt/screenshot',
  'patching.url': 'https://preprod.arquivo.pt/noFrame/patching/record',
  'contame.historias.url': 'https://contamehistorias.pt',
  'contame.historias.search.url': 'https://contamehistorias.pt/arquivopt/search',
  'oldweb.today.url': 'https://oldweb.today/',
  'oldweb.today.browser': 'ff10',
  'oldweb.today.fullUrl': 'https://oldweb.today/?browser=ff10',
  'services.archivepagenow.url': 'https://preprod.arquivo.pt/services/save/',
  'image.search.api': 'https://preprod.arquivo.pt/imagesearch',
  'query.suggestion.api': 'https://preprod.arquivo.pt/spellchecker/checker',
  'query.suggestion.api_enabled': false,
  'text.search.api.solr': 'https://preprod.arquivo.pt/textsearch',
  'text.search.api.nutchwax': 'https://preprod.arquivo.pt/textsearchnutchwax',
  'text.search.api.default': 'https://preprod.arquivo.pt/textsearch',
  'cdx.api': 'https://preprod.arquivo.pt/wayback/cdx',
  'search.start.date': '19910806',
  'text.results.per.page': 10,
  'image.results.per.page': 25,
  'session.secret': 'test-secret',
  'session.length': 604800000,
  'webapp.showContameHistoriasButton': false,
  'embargo-offset': '0001-00-00',
  'google.analytics.token': '',
  'citation.saver.google.sheet.id': '',
  'citation.saver.max.upload.size': 100000000,
  'citation.saver.upload.folder.path': 'uploads/CitationSaver',
  'logger.type': 'console',
  'logger.dir': 'logs/'
};

module.exports = {
  get: (key) => {
    if (!mockConfig.hasOwnProperty(key)) {
      throw new Error(`Configuration property "${key}" is not defined`);
    }
    return mockConfig[key];
  },
  has: (key) => {
    return mockConfig.hasOwnProperty(key);
  },
  set: (key, value) => {
    mockConfig[key] = value;
  }
};
