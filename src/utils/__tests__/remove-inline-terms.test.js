'use strict';

const removeInlineTerms = require('../../../src/utils/remove-inline-terms');

describe('removeInlineTerms', () => {
  it('should remove the terms of the given parameters, wherever they are in the query', () => {
    expect(removeInlineTerms('language:pt lisboa yearBalance:0.5 porto', ['language', 'yearBalance'])).toBe('lisboa porto');
  });

  it('should remove every term of a repeated parameter', () => {
    expect(removeInlineTerms('lisboa collection:EAWP6 collection:EAWP8', ['collection'])).toBe('lisboa');
  });

  it('should keep the terms of other parameters', () => {
    expect(removeInlineTerms('lisboa site:www.publico.pt type:png', ['collection'])).toBe('lisboa site:www.publico.pt type:png');
  });

  it('should not remove words that only contain a parameter name', () => {
    expect(removeInlineTerms('mylanguage:pt lisboa', ['language'])).toBe('mylanguage:pt lisboa');
  });

  it('should not remove a parameter name without a value', () => {
    expect(removeInlineTerms('lisboa language:', ['language'])).toBe('lisboa language:');
  });

  it('should remove the whitespace before a term and keep the rest of the whitespace', () => {
    expect(removeInlineTerms(' \t language:pt lisboa  \u00a0language:en porto  ', ['language'])).toBe('lisboa porto');
    expect(removeInlineTerms('lisboa  porto', ['language'])).toBe('lisboa  porto');
  });

  it('should remove the terms inside double quoted phrases, unless keepPhrases is set', () => {
    const query = 'lisboa "farol language:pt porto" language:en';
    expect(removeInlineTerms(query, ['language'])).toBe('lisboa "farol porto"');
    expect(removeInlineTerms(query, ['language'], { keepPhrases: true })).toBe('lisboa "farol language:pt porto"');
  });

  it('should keep the whitespace around phrases with keepPhrases', () => {
    expect(removeInlineTerms('language:pt "a b"  lisboa language:en "c"porto language:fr', ['language'], { keepPhrases: true }))
      .toBe('"a b"  lisboa "c"porto');
  });

  it('should read the terms after an unpaired quote with keepPhrases, as they are not in a phrase', () => {
    expect(removeInlineTerms('"a" "lisboa language:pt', ['language'], { keepPhrases: true })).toBe('"a" "lisboa');
  });

  // Regression: a `\s+name:` pattern was quadratic on long whitespace runs.
  it('should take linear time on long whitespace runs', () => {
    const query = 'lisboa' + ' '.repeat(50000) + 'porto';

    const start = process.hrtime.bigint();
    const result = removeInlineTerms(query, ['collection', 'language']);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(result).toBe(query);
    expect(elapsedMs).toBeLessThan(200);
  });

  it('should take linear time on many quotes with keepPhrases', () => {
    const query = '"a" '.repeat(20000) + '"' + ' '.repeat(50000) + 'language:pt';

    const start = process.hrtime.bigint();
    const result = removeInlineTerms(query, ['language'], { keepPhrases: true });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(result).toBe(('"a" '.repeat(20000) + '"').trim());
    expect(elapsedMs).toBeLessThan(200);
  });
});
