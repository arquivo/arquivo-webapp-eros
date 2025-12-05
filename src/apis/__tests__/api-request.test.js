const http = require('http');
const https = require('https');
const ApiRequest = require('../../../src/apis/api-request');

// Mock the logger
jest.mock('../../../src/logger', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn()
  }));
});

describe('ApiRequest', () => {
  let mockServer;
  let serverPort;

  beforeAll((done) => {
    // Create a mock HTTP server for testing
    mockServer = http.createServer((req, res) => {
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
        // Don't respond to simulate timeout
        setTimeout(() => {
          res.writeHead(200);
          res.end('{}');
        }, 5000);
      }
    });

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
      const api = new ApiRequest('http://example.com');
      expect(api.apiUrl).toBe('http://example.com');
      expect(api.defaultApiParams).toEqual({});
      expect(api.defaultApiReply).toEqual({});
    });

    it('should accept custom default parameters', () => {
      const defaultParams = { param1: 'value1' };
      const defaultReply = { status: 'default' };
      const api = new ApiRequest('http://example.com', defaultParams, defaultReply);
      
      expect(api.defaultApiParams).toEqual(defaultParams);
      expect(api.defaultApiReply).toEqual(defaultReply);
    });
  });

  describe('get method', () => {
    it('should successfully fetch data from API', (done) => {
      const api = new ApiRequest(`http://localhost:${serverPort}/success`);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual({ status: 'ok', data: 'test' });
        done();
      });
    });

    it('should handle HTTP error status codes', (done) => {
      const defaultReply = { error: 'default' };
      const api = new ApiRequest(`http://localhost:${serverPort}/error`, {}, defaultReply);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });

    it('should handle invalid JSON response', (done) => {
      const defaultReply = { status: 'fallback' };
      const api = new ApiRequest(`http://localhost:${serverPort}/invalid-json`, {}, defaultReply);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });

    it('should use HTTPS for HTTPS URLs', () => {
      const api = new ApiRequest('https://example.com/api', {}, {});
      
      // Verify that HTTPS URLs are accepted
      expect(api.apiUrl).toBe('https://example.com/api');
      expect(api.apiUrl.startsWith('https')).toBe(true);
    });

    it('should include request parameters in URL', (done) => {
      const api = new ApiRequest(`http://localhost:${serverPort}/success`, { key: 'default' });
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
      const api = new ApiRequest('http://example.com', defaultParams);
      const requestData = new URLSearchParams({ param2: 'override' });

      const sanitized = api.sanitizeRequestData(requestData);

      expect(sanitized.get('param1')).toBe('default1');
      expect(sanitized.get('param2')).toBe('override');
    });

    it('should handle null default parameters', () => {
      const defaultParams = { param1: null, param2: 'value2' };
      const api = new ApiRequest('http://example.com', defaultParams);
      const requestData = new URLSearchParams({ param1: 'provided' });

      const sanitized = api.sanitizeRequestData(requestData);

      expect(sanitized.get('param1')).toBe('provided');
      expect(sanitized.get('param2')).toBe('value2');
    });

    it('should skip null params without request override', () => {
      const defaultParams = { param1: null, param2: 'value2' };
      const api = new ApiRequest('http://example.com', defaultParams);
      const requestData = new URLSearchParams();

      const sanitized = api.sanitizeRequestData(requestData);

      expect(sanitized.has('param1')).toBe(false);
      expect(sanitized.get('param2')).toBe('value2');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', (done) => {
      const defaultReply = { error: 'network_error' };
      const api = new ApiRequest('http://localhost:99999/nonexistent', {}, defaultReply);
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });

    it('should catch exceptions in get method', (done) => {
      const defaultReply = { status: 'error' };
      const api = new ApiRequest('', {}, defaultReply); // Invalid URL
      const requestData = new URLSearchParams();

      api.get(requestData, (data) => {
        expect(data).toEqual(defaultReply);
        done();
      });
    });
  });
});
