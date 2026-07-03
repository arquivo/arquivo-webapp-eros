'use strict';

const mockAddRow = jest.fn();
const mockLoadInfo = jest.fn();
const mockJWT = jest.fn();
const mockLoggerError = jest.fn();
const mockGoogleSpreadsheetConstructor = jest.fn();

jest.mock('config', () => ({ get: jest.fn().mockReturnValue('test-sheet-id') }));
jest.mock('../logger', () => jest.fn(() => ({ error: mockLoggerError })));
jest.mock('../../config/service_account.json', () => ({
    client_email: 'sa@test-project.iam.gserviceaccount.com',
    private_key: 'FAKE_KEY'
}));

const addToSpreadsheet = require('../spreadsheet-client');

describe('spreadsheet-client', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockJWT.mockReturnValue({});
        mockGoogleSpreadsheetConstructor.mockImplementation(() => ({
            loadInfo: mockLoadInfo,
            sheetsByIndex: [{ addRow: mockAddRow }]
        }));
        mockLoadInfo.mockResolvedValue(undefined);
        mockAddRow.mockResolvedValue(undefined);
        addToSpreadsheet._importDeps = jest.fn().mockResolvedValue({
            GoogleSpreadsheet: mockGoogleSpreadsheetConstructor,
            JWT: mockJWT
        });
    });

    it('constructs JWT with spreadsheets scope and service account credentials', async () => {
        await addToSpreadsheet(['2024-01-01', 1000, 'user@example.com', 'File', 'doc.pdf', 'abc.pdf', '/uploads/abc.pdf']);

        expect(mockJWT).toHaveBeenCalledWith({
            email: 'sa@test-project.iam.gserviceaccount.com',
            key: 'FAKE_KEY',
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
    });

    it('loads sheet info and writes the row', async () => {
        const row = ['2024-01-01', 1000, 'user@example.com', 'File', 'doc.pdf', 'abc.pdf', '/uploads/abc.pdf'];
        await addToSpreadsheet(row);

        expect(mockLoadInfo).toHaveBeenCalledTimes(1);
        expect(mockAddRow).toHaveBeenCalledWith(row);
    });

    it('catches errors and logs them without rethrowing', async () => {
        mockLoadInfo.mockRejectedValue(new Error('network timeout'));

        await expect(addToSpreadsheet(['row'])).resolves.toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.stringContaining('Failed to connect to google services')
        );
    });
});
