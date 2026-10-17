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
});
