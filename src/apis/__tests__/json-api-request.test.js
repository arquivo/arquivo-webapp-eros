const http = require('node:http');
const https = require('node:https');
const JsonApiRequest = require('../json-api-request');

// Mock the logger
jest.mock('../../../src/logger', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn()
  }));
});

/**
 * JsonApiRequest Test Suite
 *
 * Covers the JSON API client and, through it, the request flow of BaseApiRequest:
 * constructor, GET success/error scenarios, parameter sanitization, error handling
 * (network errors, exceptions, single callback invocation, response errors), timeouts,
 * the response size cap, and the known gap where a throw from the callback is swallowed.
 */

/**
 * Mock server request handler
 */
function handleMockApiRequest(req, res, serverPort) {
  const url = new URL(req.url, `http://localhost:${serverPort}`);
  
  if (url.pathname === '/success') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', data: 'test' }));
  } else if (url.pathname === '/error') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  } else if (url.pathname === '/invalid-json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('invalid json{');
  } else if (url.pathname === '/timeout') {
    const pending = setTimeout(() => {
      res.writeHead(200);
      res.end('{}');
    }, 5000);
    // the client gives up first: don't keep the timer (and the test worker) alive
    res.on('close', () => clearTimeout(pending));
  } else if (url.pathname === '/split-utf8') {
    // "ã" is 2 bytes in UTF-8: send the body in two chunks that split it in half
    const body = Buffer.from(JSON.stringify({ q: 'São João' }));
    const cut = body.indexOf(Buffer.from('ã')) + 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(body.subarray(0, cut));
    setTimeout(() => res.end(body.subarray(cut)), 20);
  } else if (url.pathname === '/error-with-body') {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('x'.repeat(1024));
  } else if (url.pathname === '/drip') {
    // never ends: a space (valid JSON whitespace) every 20ms, so the connection is never idle
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const drip = setInterval(() => res.write(' '), 20);
    res.on('close', () => clearInterval(drip));
  } else if (url.pathname === '/large') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: 'x'.repeat(2048) }));
  } else if (url.pathname === '/echo') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: req.url }));
  }
}

describe('JsonApiRequest', () => {
  let mockServer;
  let serverPort;

  beforeAll((done) => {
    mockServer = http.createServer((req, res) => handleMockApiRequest(req, res, serverPort));
    mockServer.listen(0, () => {
      serverPort = mockServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    mockServer.close(done);
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const api = new JsonApiRequest('http://example.com');
      expect(api.apiUrl).toBe('http://example.com');
      expect(api.defaultApiParams).toEqual({});
      expect(api.defaultApiReply).toEqual({});
    });

    it('should accept custom default parameters', () => {
      const defaultParams = { param1: 'value1' };
      const defaultReply = { status: 'default' };
      const api = new JsonApiRequest('http://example.com', defaultParams, defaultReply);
      
      expect(api.defaultApiParams).toEqual(defaultParams);
      expect(api.defaultApiReply).toEqual(defaultReply);
    });
  });

  describe('get method', () => {
    it('should successfully fetch data from API', (done) => {
      const api = new JsonApiRequest(`http://localhost:${serverPort}/success`);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual({ status: 'ok', data: 'test' });
        done();
      });
    });

    it('should handle HTTP error status codes', (done) => {
      const defaultReply = { error: 'default' };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/error`, {}, defaultReply);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });

    it('should handle invalid JSON response', (done) => {
      const defaultReply = { status: 'fallback' };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/invalid-json`, {}, defaultReply);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });

    it('should use HTTPS for HTTPS URLs', () => {
      const api = new JsonApiRequest('https://example.com/api', {}, {});
      
      // Verify that HTTPS URLs are accepted
      expect(api.apiUrl).toBe('https://example.com/api');
      expect(api.apiUrl.startsWith('https')).toBe(true);
    });

    it('should include request parameters in URL', (done) => {
      const api = new JsonApiRequest(`http://localhost:${serverPort}/success`, { key: 'default' });
      const requestData = new URLSearchParams({ key: 'value', param: 'test' });

      api.get(requestData, (data) => {
        expect(data.status).toBe('ok');
        done();
      });
    });
  });

  describe('sanitizeRequestData', () => {
    it('should merge request data with default params', () => {
      const defaultParams = { param1: 'default1', param2: 'default2' };
      const api = new JsonApiRequest('http://example.com', defaultParams);
      const requestData = new URLSearchParams({ param2: 'override' });

      const sanitized = api.sanitizeRequestData(requestData);

      expect(sanitized.get('param1')).toBe('default1');
      expect(sanitized.get('param2')).toBe('override');
    });

    it('should handle null default parameters', () => {
      const defaultParams = { param1: null, param2: 'value2' };
      const api = new JsonApiRequest('http://example.com', defaultParams);
      const requestData = new URLSearchParams({ param1: 'provided' });

      const sanitized = api.sanitizeRequestData(requestData);

      expect(sanitized.get('param1')).toBe('provided');
      expect(sanitized.get('param2')).toBe('value2');
    });

    it('should skip null params without request override', () => {
      const defaultParams = { param1: null, param2: 'value2' };
      const api = new JsonApiRequest('http://example.com', defaultParams);
      const requestData = new URLSearchParams();

      const sanitized = api.sanitizeRequestData(requestData);

      expect(sanitized.has('param1')).toBe(false);
      expect(sanitized.get('param2')).toBe('value2');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', (done) => {
      const defaultReply = { error: 'network_error' };
      const api = new JsonApiRequest('http://localhost:99999/nonexistent', {}, defaultReply);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });

    it('should catch exceptions in get method', (done) => {
      const defaultReply = { status: 'error' };
      const api = new JsonApiRequest('', {}, defaultReply); // Invalid URL
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });

    it('should invoke callback only once even with multiple errors', (done) => {
      const defaultReply = { status: 'error' };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/error`, {}, defaultReply);
      const requestData = new URLSearchParams();
      
      let callCount = 0;
      api.get(requestData, (data) => {
        callCount++;
        expect(data).toEqual(defaultReply);
        
        // Wait a bit to ensure no additional callbacks
        setTimeout(() => {
          expect(callCount).toBe(1);
          done();
        }, 100);
      });
    });

    it('should not leak memory between requests', (done) => {
      const api = new JsonApiRequest(`http://localhost:${serverPort}/success`);
      const requestData = new URLSearchParams();

      // First request
      api.get(requestData, (data1) => {
        expect(data1).toEqual({ status: 'ok', data: 'test' });

        // Second request
        api.get(requestData, (data2) => {
          expect(data2).toEqual({ status: 'ok', data: 'test' });
          
          // Verify instance doesn't have accumulated state
          expect(api).not.toHaveProperty('apiReply');
          done();
        });
      });
    });

    it('should handle response errors gracefully', (done) => {
      const defaultReply = { error: 'response_error' };
      
      // Create a server that emits an error during response
      const errorServer = http.createServer((req, res) => {
        res.writeHead(200);
        res.write('partial');
        // Simulate error by destroying the response
        res.destroy();
      });

      errorServer.listen(0, () => {
        const port = errorServer.address().port;
        const api = new JsonApiRequest(`http://localhost:${port}/`, {}, defaultReply);
        const requestData = new URLSearchParams();

        api.get(requestData, (data) => {
          expect(data).toEqual(defaultReply);
          errorServer.close(done);
        });
      });
    });
  });

  /**
   * Regression tests for the request flow, run through the JSON client: the request sent,
   * the fallback reply on failure, body decoding, timeout and the known callback-throw gap
   */
  describe('request flow', () => {
    it('uses GET with a 3 minute timeout by default', () => {
      const api = new JsonApiRequest('http://example.com');
      expect(api.options).toEqual({ method: 'GET', timeout: 180000 });
    });

    it.each([
      ['missing', { method: 'GET' }],
      ['0', { method: 'GET', timeout: 0 }],
    ])('falls back to the 3 minute deadline when options.timeout is %s', (_, options, done) => {
      const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
      const api = new JsonApiRequest(`http://localhost:${serverPort}/success`);
      api.options = options;

      api.get(new URLSearchParams(), (data) => {
        expect(data).toEqual({ status: 'ok', data: 'test' });
        expect(timeoutSpy).toHaveBeenCalledWith(180000);
        timeoutSpy.mockRestore();
        done();
      });
    });

    it('requests apiUrl + "?" + the sanitized request data', (done) => {
      const api = new JsonApiRequest(`http://localhost:${serverPort}/echo`, { a: '1', b: null, c: '3', d: null });
      const requestData = new URLSearchParams({ c: 'x', b: 'y', ignored: 'z' });

      api.get(requestData, (data) => {
        expect(data).toEqual({ url: '/echo?a=1&b=y&c=x' });
        expect(api.logger.info).toHaveBeenCalledWith(`http://localhost:${serverPort}/echo?a=1&b=y&c=x`);
        done();
      });
    });

    it('logs the status code and returns the default reply on a non-2xx status', (done) => {
      const defaultReply = { fallback: true };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/error`, {}, defaultReply);

      api.get(new URLSearchParams(), (data) => {
        expect(data).toBe(defaultReply);
        expect(api.logger.error).toHaveBeenCalledWith(`http://localhost:${serverPort}/error : Invalid status code: 500`);
        done();
      });
    });

    it('logs a JSON parse error and returns the default reply on invalid JSON', (done) => {
      const defaultReply = { fallback: true };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/invalid-json`, {}, defaultReply);

      api.get(new URLSearchParams(), (data) => {
        expect(data).toBe(defaultReply);
        expect(api.logger.error).toHaveBeenCalledWith(expect.stringContaining(`http://localhost:${serverPort}/invalid-json : JSON parse error:`));
        done();
      });
    });

    it('decodes a multibyte UTF-8 character split across two chunks', (done) => {
      const api = new JsonApiRequest(`http://localhost:${serverPort}/split-utf8`);

      api.get(new URLSearchParams(), (data) => {
        expect(data).toEqual({ q: 'São João' });
        done();
      });
    });

    it('drains a non-2xx response, so a keep-alive socket is reused right away', (done) => {
      // a single keep-alive socket: the second request only gets it once the first body is read
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
      const failing = new JsonApiRequest(`http://localhost:${serverPort}/error-with-body`, {}, { fallback: true });
      const succeeding = new JsonApiRequest(`http://localhost:${serverPort}/success`);
      failing.options = { method: 'GET', timeout: 2000, agent };
      succeeding.options = { method: 'GET', timeout: 2000, agent };

      failing.get(new URLSearchParams(), (failed) => {
        expect(failed).toEqual({ fallback: true });
        const start = Date.now();
        succeeding.get(new URLSearchParams(), (data) => {
          expect(data).toEqual({ status: 'ok', data: 'test' });
          expect(Date.now() - start).toBeLessThan(1000);
          agent.destroy();
          done();
        });
      });
    });

    it('gives up after options.timeout, destroys the request and returns the default reply once', (done) => {
      const defaultReply = { fallback: 'timeout' };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/timeout`, {}, defaultReply);
      api.options.timeout = 100;
      const start = Date.now();
      let calls = 0;

      api.get(new URLSearchParams(), (data) => {
        calls++;
        expect(data).toBe(defaultReply);
        expect(Date.now() - start).toBeLessThan(2000);
        expect(api.logger.error).toHaveBeenCalledWith(`http://localhost:${serverPort}/timeout : Timeout (100ms)`);
        // destroying the timed out request must not call back a second time
        setTimeout(() => {
          expect(calls).toBe(1);
          done();
        }, 100);
      });
    });

    it('treats options.timeout as a total deadline: a body that keeps trickling in is cut', (done) => {
      const defaultReply = { fallback: 'deadline' };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/drip`, {}, defaultReply);
      api.options.timeout = 150;
      const start = Date.now();
      let calls = 0;

      api.get(new URLSearchParams(), (data) => {
        calls++;
        expect(data).toBe(defaultReply);
        expect(Date.now() - start).toBeLessThan(1000);
        expect(api.logger.error).toHaveBeenCalledWith(`http://localhost:${serverPort}/drip : Timeout (150ms)`);
        setTimeout(() => {
          expect(calls).toBe(1);
          done();
        }, 100);
      });
    });

    it('gives up after options.idleTimeout without data, before the deadline, and returns the default reply once', (done) => {
      const defaultReply = { fallback: 'idle' };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/timeout`, {}, defaultReply);
      api.options.idleTimeout = 100;
      const start = Date.now();
      let calls = 0;

      api.get(new URLSearchParams(), (data) => {
        calls++;
        expect(data).toBe(defaultReply);
        expect(Date.now() - start).toBeLessThan(2000);
        expect(api.logger.error).toHaveBeenCalledWith(`http://localhost:${serverPort}/timeout : Timeout (no data for 100ms)`);
        setTimeout(() => {
          expect(calls).toBe(1);
          done();
        }, 100);
      });
    });

    it('without options.idleTimeout, is not cut by the socket timeout of the agent (5s for the global agent)', (done) => {
      const server = http.createServer((req, res) => {
        const reply = setTimeout(() => res.end('{"ok":true}'), 300);
        res.on('close', () => clearTimeout(reply));
      });
      // like Node 20's http.globalAgent ({ keepAlive: true, timeout: 5000 }), with a shorter timeout
      const agent = new http.Agent({ keepAlive: true, timeout: 100 });

      server.listen(0, () => {
        const api = new JsonApiRequest(`http://localhost:${server.address().port}/`, {}, { fallback: true });
        api.options = { method: 'GET', timeout: 2000, agent };

        api.get(new URLSearchParams(), (data) => {
          expect(data).toEqual({ ok: true });
          agent.destroy();
          server.close(done);
        });
      });
    });

    it('gives up on a body larger than options.maxResponseBytes and returns the default reply once', (done) => {
      const defaultReply = { fallback: 'too large' };
      const api = new JsonApiRequest(`http://localhost:${serverPort}/large`, {}, defaultReply);
      api.options.maxResponseBytes = 1024;
      let calls = 0;

      api.get(new URLSearchParams(), (data) => {
        calls++;
        expect(data).toBe(defaultReply);
        expect(api.logger.error).toHaveBeenCalledWith(`http://localhost:${serverPort}/large : Response too large (over 1024 bytes)`);
        setTimeout(() => {
          expect(calls).toBe(1);
          done();
        }, 100);
      });
    });

    it('accepts a body up to options.maxResponseBytes', (done) => {
      const api = new JsonApiRequest(`http://localhost:${serverPort}/large`);
      api.options.maxResponseBytes = 4096;

      api.get(new URLSearchParams(), (data) => {
        expect(data).toEqual({ text: 'x'.repeat(2048) });
        done();
      });
    });

    it('also bounds the drain of a non-2xx body that never ends with the deadline', (done) => {
      const server = http.createServer((req, res) => {
        // an error page that keeps trickling in: only the deadline can close the connection
        res.writeHead(500);
        const drip = setInterval(() => res.write('.'), 20);
        res.on('close', () => {
          clearInterval(drip);
          expect(Date.now() - start).toBeLessThan(1000);
          server.close(done);
        });
      });
      let start;

      server.listen(0, () => {
        const defaultReply = { fallback: true };
        const api = new JsonApiRequest(`http://localhost:${server.address().port}/`, {}, defaultReply);
        api.options.timeout = 150;
        start = Date.now();

        api.get(new URLSearchParams(), (data) => {
          // the default reply comes right away, without waiting for the body
          expect(data).toBe(defaultReply);
          expect(Date.now() - start).toBeLessThan(150);
        });
      });
    });

    it('does not abort a finished request when its deadline passes, so its keep-alive socket is reused', (done) => {
      let connections = 0;
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      server.on('connection', () => connections++);
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

      server.listen(0, () => {
        const api = new JsonApiRequest(`http://localhost:${server.address().port}/`, {}, { fallback: true });
        api.options = { method: 'GET', timeout: 100, agent };

        api.get(new URLSearchParams(), (first) => {
          expect(first).toEqual({ ok: true });
          // past the first request's deadline
          setTimeout(() => {
            api.get(new URLSearchParams(), (second) => {
              expect(second).toEqual({ ok: true });
              expect(connections).toBe(1);
              expect(api.logger.error).not.toHaveBeenCalled();
              agent.destroy();
              server.close(done);
            });
          }, 200);
        });
      });
    });

    // KNOWN GAP (kept on purpose, fixed by #175, which flips this test): the callback runs
    // inside the JSON.parse try block, so an exception thrown by the callback is swallowed and
    // logged as a "JSON parse error"; the callback is not called again with the default reply.
    it('swallows a throw from the callback and logs it as a JSON parse error (known gap)', (done) => {
      const api = new JsonApiRequest(`http://localhost:${serverPort}/success`, {}, { fallback: true });
      let calls = 0;

      api.get(new URLSearchParams(), (data) => {
        calls++;
        expect(data).toEqual({ status: 'ok', data: 'test' });
        setTimeout(() => {
          expect(calls).toBe(1);
          expect(api.logger.error).toHaveBeenCalledWith(`http://localhost:${serverPort}/success : JSON parse error: boom from callback`);
          done();
        }, 50);
        throw new Error('boom from callback');
      });
    });
  });
});
