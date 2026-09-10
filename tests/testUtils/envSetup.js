// Ensures JWT_SECRET/JWT_EXPIRES_IN are set before any test file requires
// the app (jwt.sign/verify would throw otherwise). Runs via Jest's
// "setupFiles" option, before the test framework itself is set up.
process.env.JWT_SECRET = 'test-secret-key-not-for-production';
process.env.JWT_EXPIRES_IN = '1h';
