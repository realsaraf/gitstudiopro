import { expect, test } from '@playwright/test';
test('empty state opens an explicitly read-only preview', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Great work starts here.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Explore the read-only preview' })
    .click();
  await expect(
    page.getByText('READ-ONLY PREVIEW', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.commit-row')).toHaveCount(12);
});
test('history supports search, keyboard selection, and both diff layouts', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.locator('.commit-row').first().click();
  await expect(page.locator('.diff-code')).toContainText('pageSize: 150');
  await page.getByRole('button', { name: 'Unified diff', exact: true }).click();
  await expect(page.locator('.unified-code')).toBeVisible();
  await page.getByRole('button', { name: 'Side by side diff' }).click();
  await expect(page.locator('.split-code')).toBeVisible();
  await page.getByRole('listbox', { name: 'Commits' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.commit-row.selected')).toContainText(
    'keyboard navigation',
  );
  await page.getByLabel('Search loaded commits').fill('contrast');
  await expect(page.locator('.commit-row')).toHaveCount(1);
});
test('command palette and preferences work entirely offline', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search commands').fill('preferences');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Preferences' })).toBeVisible();
  await expect(page.locator('.theme-card')).toHaveCount(15);
  await page.getByRole('button', { name: /Dracula/ }).click();
  await expect(page.locator('.theme-card.selected')).toContainText('Dracula');
  await page.getByRole('tab', { name: 'Intelligence', exact: true }).click();
  await expect(
    page.getByText('AI integration is on the roadmap.', { exact: false }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page.locator('.theme-card.selected')).toContainText('Dracula');
});
test('preview refuses writes and preserves the error in the action dialog', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.getByRole('button', { name: 'New branch', exact: true }).click();
  await page.getByLabel('Branch name').fill('feature/test');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'New branch', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'read-only design preview',
  );
});
test('tabs retain independent views and can close without closing the repository', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.getByRole('button', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
  await expect(page.locator('.repository-tab')).toHaveCount(2);
  await expect(page.locator('.tab-workspace:not([hidden]) h1')).toHaveText(
    'Commit history',
  );
  await page.getByRole('tab', { name: 'gitstudiopro' }).first().click();
  await expect(page.locator('.tab-workspace:not([hidden]) h1')).toHaveText(
    'Branches',
  );
  await page.getByRole('tab', { name: 'gitstudiopro' }).first().focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.repository-tab')).toHaveCount(1);
});
test('working changes, remotes, stash, and comparison screens render', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page
    .getByRole('button', { name: 'Working changes', exact: false })
    .click();
  await expect(page.getByLabel('Commit message')).toBeVisible();
  await page.getByRole('button', { name: 'Stashes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply stash' })).toBeVisible();
  await page.getByRole('button', { name: 'Remotes', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Push', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Compare branches', exact: true })
    .click();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.comparison-result')).toContainText(
    '2 files changed',
  );
});
test('layout is bounded at the minimum desktop size and dividers support keys', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 680 });
  await page.goto('/?demo=true');
  const divider = page.getByRole('separator', { name: 'Sidebar width' });
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '268');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await divider.dblclick();
  await expect(divider).toHaveAttribute('aria-valuenow', '258');
});
