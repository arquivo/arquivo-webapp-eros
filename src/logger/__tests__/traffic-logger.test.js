'use strict';

const express = require('express');
const request = require('supertest');
const Transport = require('winston-transport');

const MESSAGE = Symbol.for('message');

describe('traffic logger', () => {
  let options;
  let middleware;
  let lines;

  beforeAll(() => {
    jest.isolateModules(() => {
      const expressWinston = require('express-winston');
      const spy = jest.spyOn(expressWinston, 'logger');
      middleware = require('../traffic-logger');
      options = spy.mock.calls[0][0];
      spy.mockRestore();
    });
    // Write to memory instead of the default transports
    const memory = new Transport();
    memory.log = (info, callback) => {
      lines.push({ level: info.level, line: info[MESSAGE] });
      callback();
    };
    options.winstonInstance.clear().add(memory);
  });

  beforeEach(() => {
    lines = [];
  });

  // An app with the traffic logger and routes like the app's own (src/router.js)
  function app() {
    const app = express();
    app.use(middleware);
    const router = express.Router();
    router.get('/search', (req, res) => res.send('ok'));
    router.post('/services/citationsaver', (req, res) => res.status(400).send('no'));
    router.get('/wayback/[*]/:url*', (req, res) => res.send('search'));
    router.get('/wayback/:url*', (req, res) => setTimeout(() => res.send('replay'), 5));
    router.get('/page/view/:url*', (req, res) => res.redirect('/'));
    router.use((req, res) => res.status(404).send('not found'));
    app.use(router);
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
    expect(typeof options.msg).toBe('string'); // a msg function's output would be compiled as a template
  });

  it('should label the lines as Traffic', () => {
    const info = options.winstonInstance.format.transform({ level: 'info', message: 'GET /' });
    expect(info[MESSAGE]).toMatch(/\tINFO\tTraffic\t-\tGET \/$/);
  });

  it('should log the method, route, status and response time, but not the query string', async () => {
    await request(app())
      .get('/search?q=' + encodeURIComponent('jane.doe@example.pt\r\nforged') + '&l=pt');
    await logged();

    expect(lines).toHaveLength(1);
    expect(lines[0].level).toBe('info');
    expect(lines[0].line).toMatch(/\tINFO\tTraffic\t-\tGET \/search 200 \d+ms$/);
    expect(lines[0].line).not.toMatch(/jane|forged|\?|l=pt/);
  });

  it('should not log a posted body', async () => {
    await request(app())
      .post('/services/citationsaver')
      .type('form')
      .send({ url: 'http://example.com/private', email: 'jane.doe@example.pt' });
    await logged();

    expect(lines).toHaveLength(1);
    expect(lines[0].line).toMatch(/\tPOST \/services\/citationsaver 400 \d+ms$/);
    expect(lines[0].line).not.toMatch(/jane|private/);
  });

  it.each([
    ['search terms in the path', '/wayback/*/jane.doe@example.pt', 'GET /wayback/[*]/:url* 200'],
    ['an archived URL', '/wayback/20230101120000/https://example.pt/jane.doe@example.pt?x=1', 'GET /wayback/:url* 200'],
    ['a viewed page', '/page/view/20230101120000/example.pt/jane.doe@example.pt', 'GET /page/view/:url* 302'],
    ['an unknown path', '/jane.doe@example.pt/x', 'GET - 404'],
  ])('should log the route pattern, not %s', async (_case, path, expected) => {
    await request(app()).get(path);
    await logged();

    expect(lines).toHaveLength(1);
    expect(lines[0].line).toMatch(new RegExp('\\t' + expected.replace(/[[\]*]/g, '\\$&') + ' \\d+ms$'));
    expect(lines[0].line).not.toMatch(/jane|example\.pt|20230101120000/);
  });
});
