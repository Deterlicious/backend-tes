// module.exports = {
//   testEnvironment: "node",
//   setupFilesAfterEnv: ["./jest.setup.js"],
//   testTimeout: 30000,
//   coverageDirectory: "coverage",
//   collectCoverageFrom: ["services/**/*.js", "models/**/*.js", "middleware/**/*.js"],
// };


module.exports = {
  testEnvironment: "node",
  testTimeout: 30000,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["services/**/*.js", "models/**/*.js", "middleware/**/*.js"],
  projects: [
    {
      displayName: "unit",
      testMatch: ["**/__tests__/unit/**/*.test.js"],
      setupFilesAfterEnv: ["./jest.setup.unit.js"], // ← afterEach cleanup
    },
    {
      displayName: "integration",
      testMatch: ["**/__tests__/integration/**/*.test.js"],
      setupFilesAfterEnv: ["./jest.setup.integration.js"], // ← TANPA afterEach
    },
  ],
};