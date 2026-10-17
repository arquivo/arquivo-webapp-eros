'use strict';

const { emphasizedHtml } = require('../result-html');

describe('emphasizedHtml', () => {
    it('should emphasize the ranges in order, escaping the text around them', () => {
        expect(emphasizedHtml('a & b < c', [[8, 9], [0, 1]])).toBe('<em>a</em> &amp; b &lt; <em>c</em>');
    });

    it('should emphasize overlapping ranges once, without nesting', () => {
        expect(emphasizedHtml('abcdef', [[0, 3], [2, 5]])).toBe('<em>abc</em><em>de</em>f');
        expect(emphasizedHtml('abcdef', [[0, 4], [1, 3]])).toBe('<em>abcd</em>ef');
    });

    it('should skip reversed and empty ranges', () => {
        expect(emphasizedHtml('abcdef', [[4, 2], [1, 1]])).toBe('abcdef');
    });

    it('should keep the ranges within the text', () => {
        expect(emphasizedHtml('abc', [[-2, 1], [2, 10], [5, 8]])).toBe('<em>a</em>b<em>c</em>');
    });
});
