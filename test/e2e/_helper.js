'use strict';

// Shared helpers for Playwright e2e specs. The base URL comes from
// playwright.config.js (`baseURL`), so specs navigate with relative paths.

// Registers a unique throwaway local user through the UI. The app starts a
// session on successful registration, so the page is logged in afterwards.
exports.registerUser = async (page) => {
  const username = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const password = `pw-${Math.random().toString(36).slice(2)}-e2e`;

  await page.goto('/register');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.locator('form[action="/register"] input[type=submit]').click();
  await page.waitForURL((url) => url.pathname !== '/register');

  return { username, password };
};
