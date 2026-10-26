'use strict';

const makeLogger = require('..');

// winston stores the final line under Symbol.for('message') (triple-beam's MESSAGE)
const MESSAGE = Symbol.for('message');

describe('logger factory', () => {
  it('should create a logger with the default transports that puts its label on every line', () => {
    const logger = makeLogger('MyLabel');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(logger.transports).toHaveLength(1);

    const info = logger.format.transform({ level: 'warn', message: 'hello' });
    expect(info[MESSAGE]).toMatch(/\tWARN\tMyLabel\t-\thello$/);
  });

  it('should use "-" as the label when none is given', () => {
    const info = makeLogger().format.transform({ level: 'info', message: 'hi' });
    expect(info[MESSAGE]).toMatch(/\tINFO\t-\t-\thi$/);
  });
});
