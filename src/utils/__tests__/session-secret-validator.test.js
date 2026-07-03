const { validateSessionSecret } = require('../session-secret-validator');

const PLACEHOLDER = 'dontWorryThisIsDifferentInProduction';

describe('validateSessionSecret', () => {
    describe('in production', () => {
        it('throws when secret equals the placeholder', () => {
            expect(() => validateSessionSecret(PLACEHOLDER, 'production')).toThrow(
                /SESSION_SECRET/
            );
        });

        it('throws when secret is empty string', () => {
            expect(() => validateSessionSecret('', 'production')).toThrow(
                /SESSION_SECRET/
            );
        });

        it('throws when secret is undefined', () => {
            expect(() => validateSessionSecret(undefined, 'production')).toThrow(
                /SESSION_SECRET/
            );
        });

        it('throws when secret is null', () => {
            expect(() => validateSessionSecret(null, 'production')).toThrow(
                /SESSION_SECRET/
            );
        });

        it('does not throw with a strong secret', () => {
            expect(() => validateSessionSecret('a-very-strong-random-secret-value', 'production')).not.toThrow();
        });
    });

    describe('outside production', () => {
        it('does not throw with placeholder in development', () => {
            expect(() => validateSessionSecret(PLACEHOLDER, 'development')).not.toThrow();
        });

        it('does not throw with placeholder when NODE_ENV is undefined', () => {
            expect(() => validateSessionSecret(PLACEHOLDER, undefined)).not.toThrow();
        });

        it('does not throw with empty secret in test environment', () => {
            expect(() => validateSessionSecret('', 'test')).not.toThrow();
        });
    });
});
