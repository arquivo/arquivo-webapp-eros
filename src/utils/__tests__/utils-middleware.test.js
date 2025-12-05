const utilsMiddleware = require('../utils-middleware');

describe('utilsMiddleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {};
        mockRes = { locals: {} };
        mockNext = jest.fn();
    });

    it('should attach utils to req.utils', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockReq.utils).toBeDefined();
        expect(typeof mockReq.utils).toBe('object');
    });

    it('should attach utils to res.locals.utils', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockRes.locals.utils).toBeDefined();
        expect(typeof mockRes.locals.utils).toBe('object');
    });

    it('should attach the same utils object to both req and res.locals', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockReq.utils).toBe(mockRes.locals.utils);
    });

    it('should call next() to continue middleware chain', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
    });

    it('should attach isValidUrl utility', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockReq.utils.isValidUrl).toBeDefined();
        expect(typeof mockReq.utils.isValidUrl).toBe('function');
    });

    it('should attach sanitizeInputs utility', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockReq.utils.sanitizeInputs).toBeDefined();
        expect(typeof mockReq.utils.sanitizeInputs).toBe('function');
    });

    it('should attach dateToTimestamp utility', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockReq.utils.dateToTimestamp).toBeDefined();
        expect(typeof mockReq.utils.dateToTimestamp).toBe('function');
    });

    it('should attach timestampToText utility', () => {
        utilsMiddleware(mockReq, mockRes, mockNext);
        
        expect(mockReq.utils.timestampToText).toBeDefined();
        expect(typeof mockReq.utils.timestampToText).toBe('function');
    });

    it('should work when res.locals is undefined', () => {
        mockRes = {};
        
        expect(() => {
            utilsMiddleware(mockReq, mockRes, mockNext);
        }).toThrow();
    });
});
