const {
    asyncHandler,
    createSafeCallback,
    formatErrorResponse,
    errorMiddleware,
    notFoundHandler
} = require('../../../src/utils/error-handler');

// Mock the logger
jest.mock('../../../src/logger', () => {
    return jest.fn(() => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    }));
});

describe('Error Handler Utilities', () => {
    describe('asyncHandler', () => {
        it('should handle successful async operations', async () => {
            const mockFn = jest.fn(async (req, res) => {
                res.json({ success: true });
            });
            
            const req = {};
            const res = { json: jest.fn() };
            const next = jest.fn();

            const wrappedFn = asyncHandler(mockFn);
            await wrappedFn(req, res, next);

            expect(mockFn).toHaveBeenCalledWith(req, res, next);
            expect(res.json).toHaveBeenCalledWith({ success: true });
            expect(next).not.toHaveBeenCalled();
        });

        it('should catch errors and pass to next middleware', async () => {
            const error = new Error('Test error');
            const mockFn = jest.fn(async () => {
                throw error;
            });

            const req = {};
            const res = {};
            const next = jest.fn();

            const wrappedFn = asyncHandler(mockFn);
            await wrappedFn(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

        it('should handle rejected promises', async () => {
            const error = new Error('Rejected promise');
            const mockFn = jest.fn(() => Promise.reject(error));

            const req = {};
            const res = {};
            const next = jest.fn();

            const wrappedFn = asyncHandler(mockFn);
            await wrappedFn(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('createSafeCallback', () => {
        it('should invoke callback on first call', () => {
            const callback = jest.fn();
            const safeCallback = createSafeCallback(callback);

            safeCallback('arg1', 'arg2');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should prevent multiple invocations', () => {
            const callback = jest.fn();
            const safeCallback = createSafeCallback(callback);

            safeCallback('first');
            safeCallback('second');
            safeCallback('third');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('first');
        });

        it('should handle callbacks with no arguments', () => {
            const callback = jest.fn();
            const safeCallback = createSafeCallback(callback);

            safeCallback();

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle callbacks with multiple arguments', () => {
            const callback = jest.fn();
            const safeCallback = createSafeCallback(callback);

            safeCallback(1, 2, 3, 4, 5);

            expect(callback).toHaveBeenCalledWith(1, 2, 3, 4, 5);
        });
    });

    describe('formatErrorResponse', () => {
        it('should format basic error response', () => {
            const error = new Error('Test error');
            const req = { originalUrl: '/test/path' };

            const response = formatErrorResponse(error, req);

            expect(response).toHaveProperty('error');
            expect(response.error.message).toBe('Test error');
            expect(response.error.status).toBe(500);
            expect(response.error.path).toBe('/test/path');
            expect(response.error).toHaveProperty('timestamp');
        });

        it('should use custom status code if provided', () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            const req = { originalUrl: '/missing' };

            const response = formatErrorResponse(error, req);

            expect(response.error.status).toBe(404);
        });

        it('should include stack trace in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = new Error('Dev error');
            const req = { originalUrl: '/test' };

            const response = formatErrorResponse(error, req);

            expect(response.error).toHaveProperty('stack');

            process.env.NODE_ENV = originalEnv;
        });

        it('should not include stack trace in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new Error('Prod error');
            const req = { originalUrl: '/test' };

            const response = formatErrorResponse(error, req);

            expect(response.error).not.toHaveProperty('stack');

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('errorMiddleware', () => {
        it('should send error response with correct status code', () => {
            const error = new Error('Server error');
            error.statusCode = 500;
            
            const req = { 
                method: 'GET',
                originalUrl: '/test' 
            };
            const res = {
                headersSent: false,
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            errorMiddleware(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
        });

        it('should use 500 as default status code', () => {
            const error = new Error('Error without status');
            
            const req = { 
                method: 'POST',
                originalUrl: '/api/test' 
            };
            const res = {
                headersSent: false,
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            errorMiddleware(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should not send response if headers already sent', () => {
            const error = new Error('Too late');
            
            const req = { 
                method: 'GET',
                originalUrl: '/test' 
            };
            const res = {
                headersSent: true,
                status: jest.fn(),
                json: jest.fn()
            };
            const next = jest.fn();

            errorMiddleware(error, req, res, next);

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('notFoundHandler', () => {
        it('should create 404 error and pass to next', () => {
            const req = { originalUrl: '/nonexistent/path' };
            const res = {};
            const next = jest.fn();

            notFoundHandler(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(Error));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(404);
            expect(error.message).toContain('/nonexistent/path');
        });
    });
});
