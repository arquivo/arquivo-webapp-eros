'use strict';

const express = require('express');
const request = require('supertest');
const Transport = require('winston-transport');

const MESSAGE = Symbol.for('message');

describe('traffic logger', () => {
  let options;
  let middleware;
  let expressWinston;

  beforeAll(() => {
    jest.isolateModules(() => {
      expressWinston = require('express-winston');
      const spy = jest.spyOn(expressWinston, 'logger');
      middleware = require('../traffic-logger');
      options = spy.mock.calls[0][0];
      spy.mockRestore();
    });
  });

  // The traffic logger's options, writing to memory instead of the default transports.
  function appLoggingTo(lines) {
    const memory = new Transport();
    memory.log = (info, callback) => {
      lines.push({ level: info.level, line: info[MESSAGE] });
      callback();
    };
    const app = express();
    // express-winston keeps the logger it made in the options: make another one
    app.use(expressWinston.logger({ ...options, winstonInstance: undefined, transports: [memory] }));
    app.get('/search', (req, res) => res.send('ok'));
    app.post('/services/citationsaver', (req, res) => res.status(400).send('no'));
    return app;
  }

  // The line is written once the response is over, through winston's streams.
  const logged = () => new Promise(resolve => setTimeout(resolve, 20));

  it('should export an Express middleware', () => {
    expect(typeof middleware).toBe('function');
    expect(middleware).toHaveLength(3);
  });

  it('should log every route, without collecting request metadata', () => {
    expect(options.ignoreRoute({}, {})).toBe(false);
    expect(options.expressFormat).toBeFalsy();
    expect(options.meta).toBe(false);
  });

  it('should label the lines as Traffic', () => {
    const info = options.format.transform({ level: 'info', message: 'GET /' });
    expect(info[MESSAGE]).toMatch(/\tINFO\tTraffic\t-\tGET \/$/);
  });

  it('should log the method, path, status and response time, but not the query string', async () => {
    const lines = [];
    await request(appLoggingTo(lines))
      .get('/search?q=' + encodeURIComponent('jane.doe@example.pt\r\nforged') + '&l=pt');
    await logged();

    expect(lines).toHaveLength(1);
    expect(lines[0].level).toBe('info');
    expect(lines[0].line).toMatch(/\tINFO\tTraffic\t-\tGET \/search 200 \d+ms$/);
    expect(lines[0].line).not.toMatch(/jane|forged|\?|l=pt/);
  });

  it('should not log a posted body', async () => {
    const lines = [];
    await request(appLoggingTo(lines))
      .post('/services/citationsaver')
      .type('form')
      .send({ url: 'http://example.com/private', email: 'jane.doe@example.pt' });
    await logged();

    expect(lines).toHaveLength(1);
    expect(lines[0].line).toMatch(/\tPOST \/services\/citationsaver 400 \d+ms$/);
    expect(lines[0].line).not.toMatch(/jane|private/);
  });
});
