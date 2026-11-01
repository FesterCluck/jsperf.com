'use strict';

const { defineConfig, devices } = require('@playwright/test');

const port = process.env.E2E_PORT || '3100';
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;

// E2E needs a reachable MySQL (the server runs migrations on startup) and the
// usual env vars (MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, COOKIE_PASS, .env
// is honored). Redis is only required when NODE_ENV=production.
// Set E2E_BASE_URL to test an already running server instead of starting one.
module.exports = defineConfig({
  testDir: 'test/e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: 'test/e2e/screenshots',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node server.js',
        url: `${baseURL}/faq`,
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
        env: { PORT: port, COOKIE_PASS: process.env.COOKIE_PASS || 'e2e-cookie-password-at-least-32-chars!!' }
      }
});
