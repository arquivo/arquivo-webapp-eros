const logger = require('../logger')('ErrorHandler');

/**
 * ============================================================================
 * ERROR HANDLER UTILITIES
 * ============================================================================
 * 
 * Comprehensive error handling utilities for Express applications.
 * Provides consistent error handling patterns across the application.
 * 
 * Features:
 * - Async/await error handling for Express routes
 * - Safe callback wrappers to prevent multiple invocations
 * - Standardized error response formatting
 * - Express error middleware
 * - 404 Not Found handler
 * 
 * @module error-handler
 */

/**
 * Async error handler wrapper for Express route handlers
 * 
 * Problem:
 * Express doesn't automatically catch errors in async functions. If an async
 * route handler throws an error or has a rejected promise, it won't be caught
 * by Express's error handling middleware.
 * 
 * Solution:
 * This wrapper catches all errors (thrown or rejected promises) and passes
 * them to Express's error handling via next(error).
 * 
 * Benefits:
 * - Eliminates try-catch boilerplate in every async route
 * - Ensures all errors reach error handling middleware
 * - Makes async route handlers work seamlessly with Express
 * 
 * @param {Function} fn - Async route handler function (req, res, next) => Promise
 * @returns {Function} - Wrapped handler that catches errors
 * 
 * @example
 * // Without asyncHandler (verbose, error-prone)
 * router.get('/data', async (req, res, next) => {
 *   try {
 *     const data = await fetchData();
 *     res.json(data);
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 * 
 * @example
 * // With asyncHandler (clean, automatic error handling)
 * router.get('/data', asyncHandler(async (req, res) => {
 *   const data = await fetchData();
 *   res.json(data);
 *   // Errors automatically caught and passed to error middleware
 * }));
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        // Wrap in Promise.resolve() to handle both sync and async errors
        // catch() ensures any rejection is passed to Express error handler
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Creates a safe callback wrapper that ensures callback is only invoked once
 * 
 * Problem:
 * In async operations with multiple error paths (network errors, timeouts,
 * response errors), the same callback might be invoked multiple times,
 * leading to:
 * - Race conditions
 * - Duplicate responses
 * - Memory leaks
 * - Unpredictable behavior
 * 
 * Solution:
 * Wraps the callback to track invocation state. After first call, subsequent
 * calls are ignored and logged as warnings.
 * 
 * Use Cases:
 * - HTTP requests with multiple error events
 * - Async operations with timeout + error handlers
 * - Callbacks passed to multiple event listeners
 * - Any scenario where callback might be triggered multiple times
 * 
 * @param {Function} callback - The original callback function
 * @param {string} [context='callback'] - Context name for logging (helps debugging)
 * @returns {Function} - Wrapped callback that can only be called once
 * 
 * @example
 * function fetchData(callback) {
 *   const safeCallback = createSafeCallback(callback, 'fetchData');
 *   
 *   request.on('data', () => safeCallback(data));  // First call: executes
 *   request.on('end', () => safeCallback(data));   // Second call: ignored + warning
 *   request.on('error', () => safeCallback(null)); // Third call: ignored + warning
 * }
 */
function createSafeCallback(callback, context = 'callback') {
    let invoked = false;
    
    return (...args) => {
        if (!invoked) {
            invoked = true;
            callback(...args);
        } else {
            // Log warning but don't throw - prevents cascading errors
            logger.warn(`${context} attempted to be called multiple times. Ignoring subsequent call.`);
        }
    };
}

/**
 * Formats errors into a consistent JSON response structure
 * 
 * Purpose:
 * Creates standardized error responses that clients can reliably parse.
 * Different behavior in development vs production for security.
 * 
 * Response Structure:
 * {
 *   error: {
 *     message: string,      // Error message (safe for display)
 *     status: number,       // HTTP status code
 *     timestamp: string,    // ISO 8601 timestamp
 *     path: string,         // Request path that caused error
 *     stack: string         // Stack trace (development only)
 *   }
 * }
 * 
 * Security Note:
 * Stack traces are ONLY included in development mode to prevent
 * leaking sensitive implementation details to clients in production.
 * 
 * @param {Error} error - The error object to format
 * @param {Object} req - Express request object (for context)
 * @returns {Object} - Formatted error response object
 * 
 * @example
 * const error = new Error('Database connection failed');
 * error.statusCode = 503;
 * const response = formatErrorResponse(error, req);
 * // {
 * //   error: {
 * //     message: 'Database connection failed',
 * //     status: 503,
 * //     timestamp: '2025-12-05T12:00:00.000Z',
 * //     path: '/api/users',
 * //     stack: '...' // Only in development
 * //   }
 * // }
 */
function formatErrorResponse(error, req) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    return {
        error: {
            message: error.message || 'An unexpected error occurred',
            status: error.statusCode || 500,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            // Conditionally include stack trace (development only)
            ...(isDevelopment && { stack: error.stack })
        }
    };
}

/**
 * Express error handling middleware
 * 
 * Purpose:
 * Central error handler for all Express errors. Catches errors from:
 * - Thrown exceptions in route handlers
 * - next(error) calls
 * - asyncHandler-wrapped functions
 * - Any middleware errors
 * 
 * Behavior:
 * 1. Logs error with full context (method, URL, message, stack)
 * 2. Checks if headers already sent (prevents "Can't set headers" error)
 * 3. Sends formatted JSON error response with appropriate status code
 * 
 * Important:
 * - Must be added AFTER all routes and middleware
 * - Must have 4 parameters (err, req, res, next) - Express recognizes
 *   error middleware by 4-parameter signature
 * - Should be the last middleware in the chain
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * 
 * @example
 * // In server.js, add AFTER all routes:
 * 
 * // Regular routes
 * app.use('/api', apiRoutes);
 * app.use('/users', userRoutes);
 * 
 * // Error handling (must be last)
 * app.use(notFoundHandler);    // Catch 404s first
 * app.use(errorMiddleware);    // Then handle all errors
 */
function errorMiddleware(err, req, res, next) {
    // Log error with context for debugging
    logger.error(`Error handling ${req.method} ${req.originalUrl}`, {
        error: err.message,
        stack: err.stack,
        statusCode: err.statusCode || 500
    });

    // Safety check: if response has already started, pass to default handler
    // This prevents "Cannot set headers after they are sent" errors
    if (res.headersSent) {
        return next(err);
    }

    // Send formatted error response
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json(formatErrorResponse(err, req));
}

/**
 * 404 Not Found handler
 * 
 * Purpose:
 * Catches requests to undefined routes and creates a proper 404 error.
 * Without this, undefined routes would hang or return empty responses.
 * 
 * Flow:
 * 1. If no route matches, this handler is reached
 * 2. Creates an Error with descriptive message
 * 3. Sets statusCode to 404
 * 4. Passes to errorMiddleware via next(error)
 * 
 * Important:
 * - Must be added BEFORE errorMiddleware
 * - Must be added AFTER all valid routes
 * - Only reached when no other route matches
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * 
 * @example
 * // In server.js:
 * 
 * // All valid routes
 * app.use('/api', apiRoutes);
 * 
 * // 404 handler (after valid routes, before error middleware)
 * app.use(notFoundHandler);
 * 
 * // Error handler (must be last)
 * app.use(errorMiddleware);
 * 
 * @example
 * // Request to /nonexistent/route
 * // Response:
 * // {
 * //   "error": {
 * //     "message": "Not Found - /nonexistent/route",
 * //     "status": 404,
 * //     "timestamp": "2025-12-05T12:00:00.000Z",
 * //     "path": "/nonexistent/route"
 * //   }
 * // }
 */
function notFoundHandler(req, res, next) {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
}

module.exports = {
    asyncHandler,
    createSafeCallback,
    formatErrorResponse,
    errorMiddleware,
    notFoundHandler
};
