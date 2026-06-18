// Bypasses __mocks__/config.js to verify that the real config library
// can parse config/default.properties at startup. Catches accidental removal
// of implicit runtime dependencies (e.g. the `properties` parser package).
describe('config startup', () => {
  it('parses config/default.properties without crashing', () => {
    const config = jest.requireActual('config');
    expect(() => config.get('backend.url')).not.toThrow();
    expect(typeof config.get('backend.url')).toBe('string');
  });
});
