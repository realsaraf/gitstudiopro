import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('workspace and modal have no serious automated accessibility violations', async ({
  page,
}) => {
  await page.goto('/?demo=true');
  await page.locator('.commit-row').first().waitFor();
  for (const scene of ['workspace', 'preferences', 'commands', 'themes']) {
    if (scene === 'preferences')
      await page
        .getByRole('button', { name: 'Preferences', exact: true })
        .click();
    if (scene === 'commands') {
      await page.keyboard.press('Escape');
      await page.keyboard.press('Control+k');
    }
    if (scene === 'themes')
      await page.getByLabel('Search commands').fill('theme');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
    ).toEqual([]);
  }
});
