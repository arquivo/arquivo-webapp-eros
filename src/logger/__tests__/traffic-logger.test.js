'use strict';

const MESSAGE = Symbol.for('message');

describe('traffic logger', () => {
  let options;
  let middleware;

  beforeAll(() => {
    jest.isolateModules(() => {
      const expressWinston = require('express-winston');
      const spy = jest.spyOn(expressWinston, 'logger');
      middleware = require('../traffic-logger');
      options = spy.mock.calls[0][0];
      spy.mockRestore();
    });
  });

  it('should export an Express middleware', () => {
    expect(typeof middleware).toBe('function');
    expect(middleware).toHaveLength(3);
  });

  it('should log every route with the Express request format', () => {
    expect(options.ignoreRoute({}, {})).toBe(false);
    expect(options.expressFormat).toBe(true);
  });

  it('should label the lines as Traffic', () => {
    const info = options.format.transform({ level: 'info', message: 'GET /' });
    expect(info[MESSAGE]).toMatch(/\tINFO\tTraffic\t-\tGET \/$/);
  });
});
