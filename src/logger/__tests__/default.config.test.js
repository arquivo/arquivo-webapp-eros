'use strict';

// winston stores the final line under Symbol.for('message') (triple-beam's MESSAGE)
const MESSAGE = Symbol.for('message');
const getDefaults = require('../default.config');

describe('logger default config', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should prefix each line with the day of the month, not the day of the week', () => {
    // Friday 16 October 2026: a 'dd' (day of week) pattern would log '05/Oct/2026'
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 16, 9, 5, 7));
    const info = getDefaults('my-label').format.transform({ level: 'info', message: 'hello' });
    expect(info[MESSAGE]).toBe('16/Oct/2026:09:05:07\tINFO\tmy-label\t-\thello');
  });

  describe('with the daily logger', () => {
    // The daily transport's options with these settings, without creating any file
    function dailyTransportOptions(settings = {}) {
      let options;
      jest.isolateModules(() => {
        const config = require('config');
        Object.entries({ 'logger.type': 'daily', ...settings }).forEach(([key, value]) => config.set(key, value));
        jest.doMock('winston-daily-rotate-file', () => {
          require('winston').transports.DailyRotateFile = jest.fn(function (opts) { options = opts; });
        });
        require('../default.config');
      });
      return options;
    }

    it('should delete the files older than logger.maxFiles (30 days by default)', () => {
      expect(dailyTransportOptions()).toEqual(expect.objectContaining({
        dirname: 'logs/',
        maxFiles: '30d',
        auditFile: 'logs/.arquivo-webapp-audit.json',
      }));
    });

    it('should keep its list of files when the retention changes', () => {
      expect(dailyTransportOptions({ 'logger.maxFiles': '7d' })).toEqual(expect.objectContaining({
        maxFiles: '7d',
        auditFile: 'logs/.arquivo-webapp-audit.json',
      }));
    });
  });
});
