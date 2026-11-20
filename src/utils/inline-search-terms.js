'use strict';

// Terms typed in the query as name:value (e.g. "collection:FCCN") that are moved into their own
// request parameter: site and safe into siteSearch and safeSearch, the others into a parameter of the same name
module.exports = Object.freeze(['site', 'type', 'collection', 'safe', 'size', 'yearBalance', 'language', 'minLanguageConfidence']);
