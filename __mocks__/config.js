// Mock config module for Jest tests
const mockConfig = {
  'backend.url': 'https://preprod.arquivo.pt',
  'wayback.url': 'https://preprod.arquivo.pt/wayback',
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
