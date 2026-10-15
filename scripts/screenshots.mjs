import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/screenshots', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
const base = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:1420';
const capture = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  console.log(`Captured ${name}`);
};
try {
  await page.goto(base);
  await capture('welcome');
  await page.goto(`${base}/?demo=true`);
  await page.locator('.commit-row').first().waitFor();
  await page
    .locator('.diff-code')
    .getByText('pageSize: 150,', { exact: false })
    .waitFor();
  await capture('workspace');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await capture('themes');
  await page.getByRole('button', { name: /Dracula/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await capture('command-palette');
  await page.getByLabel('Search commands').fill('theme');
  await capture('command-themes');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Working changes', exact: false })
    .click();
  await page
    .locator('.diff-code')
    .getByText('pageSize: 150,', { exact: false })
    .waitFor();
  await capture('working-changes');
} finally {
  await browser.close();
}
