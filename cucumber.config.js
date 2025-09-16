const { defineBddConfig } = require('playwright-bdd');

const testDir = defineBddConfig({
  features: 'e2e/features',
  steps: 'e2e/steps/**/*.ts',
});

module.exports = {
  testDir,
  // Other Playwright configuration options can be added here
  use: {
    baseURL: 'http://localhost:4173',
  },
};