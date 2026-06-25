/**
 * Jest Setup File
 * Runs before all tests to configure the test environment
 */

// Set NODE_ENV to test so server doesn't auto-start
process.env.NODE_ENV = "test";

// Set default JWT configuration for tests
process.env.JWT_SIGNING_KEY = process.env.JWT_SIGNING_KEY || "test-secret-key-min-32-characters!!";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || "test-api";
process.env.JWT_ISSUER = process.env.JWT_ISSUER || "test-issuer";
process.env.JWT_ALGORITHMS = process.env.JWT_ALGORITHMS || "HS256";  // Match the signing algorithm in fixtures

// Mock Cosmos connection settings (will be mocked by jest.mock in test file)
process.env.COSMOS_CONNECTION_STRING = "AccountEndpoint=https://test-account.documents.azure.com:443/;AccountKey=test-key-for-testing-only-min-88-characters-long-!!!!!!!!!";
