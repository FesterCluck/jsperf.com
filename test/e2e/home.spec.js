'use strict';

const { test, expect } = require('@playwright/test');
const { registerUser } = require('./_helper');

test.describe('Home page', () => {
  test('loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/jsPerf/);
  });

  test('browse', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Latest' }).click();
    await expect(page).toHaveTitle(/Browse/);

    const link = page.locator('article ul li a').first();
    test.skip(await link.count() === 0, 'database has no public test cases to browse');

    const href = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('create page', async ({ page }) => {
    await registerUser(page);
    await page.goto('/');

    const now = Date.now();
    await page.fill('#title', `Test ${now}`);
    await page.check('#visible');
    await page.fill('#info', `This is my test at ${now}`);
    await page.fill('#initHTML', `<p>${now}</p>`);
    await page.fill('#setup', 'var a = [];');
    await page.fill('#teardown', 'delete a;');
    await page.fill('[id="test[0][title]"]', `Title ${now} 0`);
    await page.fill('[id="test[0][code]"]', `a.push(${now});`);
    await page.fill('[id="test[1][title]"]', `Title ${now} 1`);
    await page.fill('[id="test[1][code]"]', `a[0] = ${now};`);
    await page.locator('form[action="/"]').evaluate((f) => f.submit());

    // should redirect to new /slug page
    await page.waitForURL((url) => url.pathname.length > 1);
  });
});
