'use strict';

const { test, expect } = require('@playwright/test');

const pages = [
  ['/faq', /Frequent/],
  ['/contributors', /Contributors/],
];

for (const [path, title] of pages) {
  test(`${path} loads`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  });
}

test('404 page', async ({ page }) => {
  const res = await page.goto('/404');
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('Not Found');
});
