/**
 * Jest Configuration for API Tests
 */

module.exports = {
  displayName: "api-tests",
  testEnvironment: "node",
  testMatch: [
    "**/tests/**/*.test.ts",
    "**/tests/**/*.spec.ts",
  ],
  preset: "ts-jest",
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "*.ts",
    "!*.d.ts",
    "!dist/**",
    "!node_modules/**",
    "!tests/**",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 10000,
  verbose: true,
  bail: false,
};
