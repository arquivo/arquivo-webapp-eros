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
});
