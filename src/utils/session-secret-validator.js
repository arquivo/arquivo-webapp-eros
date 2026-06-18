const PLACEHOLDER = 'dontWorryThisIsDifferentInProduction';

function validateSessionSecret(secret, nodeEnv) {
    if (nodeEnv !== 'production') return;
    if (!secret || secret === PLACEHOLDER) {
        throw new Error(
            'SESSION_SECRET is not set or still uses the committed placeholder. ' +
            'Set SESSION_SECRET to a strong, unique value before starting in production. ' +
            'The placeholder value is burned and must not be reused.'
        );
    }
}

module.exports = { validateSessionSecret };
