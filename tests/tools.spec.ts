import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('repository tools are searchable, keyboard accessible, and guard writes', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page
    .getByRole('button', { name: 'Repository tools', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Repository tools' });
  await expect(page.getByLabel('Find Git tool')).toBeFocused();
  await page.getByLabel('Find Git tool').fill('remote');
  await dialog.getByRole('button', { name: 'Add remote', exact: true }).click();
  const detail = dialog.getByRole('region', { name: 'Add remote' });
  await detail.getByLabel('Remote name').fill('test');
  await detail
    .getByLabel('URL or path')
    .fill('https://example.invalid/repo.git');
  await expect(
    detail.getByRole('button', { name: 'Add remote', exact: true }),
  ).toBeDisabled();
  await detail.getByLabel('Remote name').press('Enter');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await detail.getByRole('checkbox').check();
  await detail.getByRole('button', { name: 'Add remote', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('read-only');
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
      .map((v) => v.id),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('pull requests are discoverable and host forms remain accessible', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page
    .getByRole('button', { name: 'Pull requests', exact: true })
    .click();
  const panel = page.locator('.tab-workspace:not([hidden]) .host-panel');
  await expect(
    panel.getByRole('heading', { name: 'GitHub / GitHub Enterprise' }),
  ).toBeVisible();
  await panel.getByLabel('Host repository').fill('fixture/project');
  await panel
    .getByRole('button', { name: 'Load pull requests', exact: true })
    .click();
  await expect(panel.getByRole('alert')).toContainText('desktop app');
  await expect(
    panel.getByRole('button', { name: 'Publish remote action' }),
  ).toBeDisabled();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
      .map((v) => v.id),
  ).toEqual([]);
});
test('palette opens advanced tools and clone/init works without an open repository', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search commands').fill('interactive rebase');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('region', { name: 'Interactive rebase', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/');
  await page
    .getByRole('button', {
      name: 'Clone or initialize repository',
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Operation', { exact: true }).selectOption('init');
  await expect(dialog.getByLabel('New destination path')).toBeVisible();
  await dialog.getByLabel('New destination path').fill('C:/preview-only');
  await dialog
    .getByRole('button', { name: 'Initialize repository', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('desktop app');
});
