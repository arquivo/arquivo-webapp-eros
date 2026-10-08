module.exports = {
  ...require('./jest.config.js'),
  // Match on the repo-relative test file rather than a bare "accessibility" path pattern,
  // which would also match any checkout whose absolute path contains that word.
  testMatch: ['<rootDir>/src/__tests__/accessibility.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
};
