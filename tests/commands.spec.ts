import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function search(page: Page, query: string) {
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeFocused();
  await page.keyboard.type(query);
  return input;
}

test('all themes are directly selectable, searchable by aliases, and persist', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferences', exact: true }).focus();
  const input = await search(page, 'theme');
  await expect(page.getByRole('option', { name: /^Theme:/ })).toHaveCount(15);
  await input.fill('  LIGHT  theme  ');
  await expect(page.getByRole('option', { name: /^Theme:/ })).toHaveCount(4);
  await input.fill('frappe');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('Current');
  await input.fill('dracula theme');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page.locator('.theme-card.selected')).toContainText('Dracula');
  await page.getByRole('button', { name: /Studio Day/ }).click();
  await page.keyboard.press('Escape');
  await search(page, 'studio day');
  await expect(page.getByRole('option')).toContainText('Current');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Preferences', exact: true }).focus();
  await search(page, 'studio day');
  await expect(page.getByRole('option')).toContainText('Current');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
});

test('direct settings sync with preferences and survive reload', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.locator('.commit-row').first().waitFor();
  await search(page, 'text size 18');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveCSS('font-size', '18px');
  await search(page, 'increase text');
  await expect(
    page
      .getByRole('listbox', { name: 'Commands', exact: true })
      .getByRole('option'),
  ).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await search(page, 'reduce motion');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute(
    'data-reduce-motion',
    'true',
  );
  await search(page, 'unified diff');
  await page.keyboard.press('Enter');
  await expect(page.locator('.unified-code')).toBeVisible();
  await page.reload();
  await page.locator('.commit-row').first().waitFor();
  await expect(page.locator('html')).toHaveCSS('font-size', '18px');
  await expect(page.locator('.unified-code')).toBeVisible();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page.getByLabel('Text size', { exact: true })).toHaveValue('18');
  await expect(
    page.getByRole('switch', { name: 'Reduce motion' }),
  ).toBeChecked();
  await expect(page.getByLabel('Default diff layout')).toHaveValue('unified');
  await page.keyboard.press('Escape');
  await search(page, 'reset text');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveCSS('font-size', '15px');
});

test('keyboard selection stays visible, handles empty results, and resets on reopening', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 680 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferences', exact: true }).focus();
  const input = await search(page, 'theme:');
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowDown');
  const active = page.getByRole('option', { selected: true });
  await expect(active).toContainText('One Dark');
  expect(
    await active.evaluate((el) => {
      const row = el.getBoundingClientRect();
      const list = el.parentElement!.getBoundingClientRect();
      return row.top >= list.top - 1 && row.bottom <= list.bottom + 1;
    }),
  ).toBe(true);
  await expect(input).toBeInViewport();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { selected: true })).toContainText(
    'Catppuccin Frappé',
  );
  await input.fill('no-such-command');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('No matching commands.', { exact: false }),
  ).toBeVisible();
  await expect(input).not.toHaveAttribute('aria-activedescendant');
  await page.keyboard.press('Escape');
  await search(page, '');
  await expect(input).toHaveValue('');
  await expect(page.getByRole('option', { selected: true })).toContainText(
    'New tab',
  );
});

test('settings destinations, licenses, and preference tabs are keyboard accessible', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferences', exact: true }).focus();
  await search(page, 'intelligence settings');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Intelligence' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Repository hosts' }),
  ).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText(
    'Git fetch/push authentication is separate',
  );
  await page.keyboard.press('Escape');
  await search(page, 'credits licenses');
  await page.keyboard.press('Enter');
  await expect(page.locator('.license-credits')).toHaveAttribute('open');
  await expect(page.locator('.license-credits > summary')).toBeFocused();
});

test('unavailable actions explain why; repository commands open existing dialogs', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferences', exact: true }).focus();
  await search(page, 'new branch');
  await expect(page.getByRole('option', { name: /^New branch/ })).toContainText(
    'Open a repository first',
  );
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Command palette' }),
  ).toBeVisible();
  await page.goto('/?demo=true');
  await page.locator('.commit-row').first().waitFor();
  for (const [query, title] of [
    ['new branch', 'New branch'],
    ['stash working', 'Stash working changes'],
    ['pull current', 'Pull current branch'],
    ['push current', 'Push current branch'],
  ]) {
    await search(page, query);
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('dialog', { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
  }
  await search(page, 'fetch remotes');
  await page.keyboard.press('Enter');
  await expect(page.locator('h1')).toHaveText('Remotes');
});

test('palette resets layout and switches and closes repository tabs', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.locator('.commit-row').first().waitFor();
  const divider = page.getByRole('separator', { name: 'Sidebar width' });
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await search(page, 'reset panel layout');
  await page.keyboard.press('Enter');
  await expect(divider).toHaveAttribute('aria-valuenow', '258');
  await page.getByRole('button', { name: 'Branches', exact: true }).click();
  await search(page, 'new tab');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Open preview', exact: true }).click();
  await search(page, 'switch to');
  await page.keyboard.press('Enter');
  await expect(page.locator('.tab-workspace:not([hidden]) h1')).toHaveText(
    'Branches',
  );
  await search(page, 'close current tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'gitstudiopro' })).toHaveCount(1);
  await expect(page.locator('.tab-workspace:not([hidden]) h1')).toHaveText(
    'Commit history',
  );
});
