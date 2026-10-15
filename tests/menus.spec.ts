import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('commit context menu supports mouse, keyboard, focus restoration and accessible roles', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.locator('.commit-row').first().click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Commit actions' });
  await expect(menu).toBeVisible();
  // The preview has working changes, so history rewriting is unavailable.
  await expect(
    menu.getByRole('menuitem', { name: 'Cherry-pick commit' }),
  ).toBeDisabled();
  await expect(
    menu.getByRole('menuitem', { name: 'Create branch at commit' }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    menu.getByRole('menuitem', { name: 'Create tag', exact: true }),
  ).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
      .map((v) => v.id),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Commit actions', exact: true }),
  ).toBeFocused();
  await page.getByRole('listbox', { name: 'Commits', exact: true }).focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.getByRole('menuitem', { name: 'Create branch at commit' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Create branch at commit' }),
  ).toBeVisible();
  await expect(page.getByLabel('Branch name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('branch and repository menus expose contextual controls', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.getByRole('button', { name: 'Branches', exact: true }).click();
  await page
    .getByRole('button', { name: 'Branch actions for main', exact: true })
    .click();
  await page
    .getByRole('menuitem', { name: 'Rename branch', exact: true })
    .click();
  await expect(page.getByLabel('New branch name')).toHaveValue('main');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Repository actions', exact: true })
    .click();
  await page
    .getByRole('menuitem', { name: 'Publish current branch', exact: true })
    .click();
  await expect(page.getByLabel('Remote name')).toHaveValue('origin');
});
