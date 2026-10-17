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

  describe('logger.level', () => {
    // The defaults with this logger.level, in a fresh module registry
    function defaultsWithLevel(level) {
      let defaults;
      jest.isolateModules(() => {
        if (level !== undefined) require('config').set('logger.level', level);
        defaults = require('../default.config')('my-label');
      });
      return defaults;
    }

    it('should write info and above by default, so debug lines (personal data) are dropped', () => {
      expect(defaultsWithLevel().level).toBe('info');
    });

    it('should take another level from the setting', () => {
      expect(defaultsWithLevel('debug').level).toBe('debug');
    });

    it.each(['inf', 'DEBUG', '', 'constructor'])('should refuse to start with the unknown level "%s"', (level) => {
      expect(() => defaultsWithLevel(level)).toThrow(/"logger\.level" \(LOGGER_LEVEL\) must be one of error, warn, info/);
    });
  });
});
