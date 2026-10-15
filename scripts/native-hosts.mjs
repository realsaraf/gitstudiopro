// Runs inside the real WebView2 harness. All publishing targets this loopback fixture.
import { createServer } from 'node:http';
import { expect as baseExpect } from '@playwright/test';
import { join } from 'node:path';
const expect = baseExpect.configure({ timeout: 20000 });
export async function testHosts(page, evidence) {
  const requests = [];
  const secret = 'local-fixture-token-not-a-real-credential';
  const pull = {
    number: 7,
    title: 'Fixture pull request',
    body: 'Review fixture body',
    state: 'open',
    user: { login: 'fixture' },
    head: { sha: 'a'.repeat(40), ref: 'feature' },
    base: { ref: 'main' },
  };
  const server = createServer(async (req, res) => {
    let data = '';
    for await (const chunk of req) data += chunk;
    requests.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      body: data ? JSON.parse(data) : undefined,
    });
    if (req.url.startsWith('/redirect/')) {
      res.writeHead(302, { Location: '/unexpected' });
      res.end();
      return;
    }
    let result = { html_url: 'https://example.invalid/fixture/7' };
    if (req.method === 'GET') {
      if (req.url.endsWith('/user')) result = { login: 'fixture-user' };
      else if (req.url.includes('/files?'))
        result = [
          {
            filename: 'fixture.txt',
            status: 'modified',
            additions: 1,
            deletions: 1,
            patch: '@@ -1 +1 @@\n-old\n+new',
          },
        ];
      else if (req.url.includes('/pulls?')) result = [pull];
      else result = pull;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/v3`;
  const prefix = endpoint.replace('/api/v3', '');
  let stored = false;
  try {
    if (await page.getByRole('dialog').count())
      await page
        .getByRole('button', { name: 'Close dialog', exact: true })
        .click();
    await page
      .getByRole('button', { name: 'Preferences', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Repository hosts' }).click();
    const panel = page.locator('.host-panel');
    const base = panel.getByLabel('API base URL', { exact: true });
    await base.fill(endpoint);
    await panel.getByLabel('Host repository').fill('fixture/project');
    await panel
      .getByRole('button', { name: 'Load pull requests', exact: true })
      .click();
    await expect(panel.getByRole('status')).toHaveText(
      'Loaded 1 pull requests.',
    );
    expect(requests.at(-1).authorization).toBeUndefined();
    expect(requests.at(-1).url).toBe(
      '/api/v3/repos/fixture/project/pulls?per_page=50&page=1&state=open',
    );
    await panel.getByLabel('Host access token').fill(secret);
    await panel.getByRole('button', { name: 'Save host connection' }).click();
    await expect(panel.getByRole('status')).toHaveText(
      'Connection settings saved.',
    );
    stored = true;
    await expect(panel.getByLabel('Host access token')).toHaveValue('');
    const storage = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    );
    expect(storage).not.toContain(secret);
    await panel
      .getByRole('button', { name: 'Test connection', exact: true })
      .click();
    await expect(panel.getByRole('status')).toHaveText(
      'Connected as fixture-user.',
    );
    expect(requests.at(-1).authorization).toBe(`Bearer ${secret}`);
    await panel
      .getByRole('button', { name: /#7 Fixture pull request/ })
      .click();
    await expect(panel.locator('.host-description')).toHaveText(
      'Review fixture body',
    );
    await panel.getByRole('button', { name: 'Load changed files' }).click();
    await expect(panel.getByRole('status')).toHaveText('Loaded file page 1.');
    await panel.locator('summary').filter({ hasText: 'fixture.txt' }).click();
    await expect(panel.locator('.host-patch')).toContainText('+new');
    const publish = panel.getByRole('button', {
      name: 'Publish remote action',
    });
    for (const action of [
      'createPull',
      'comment',
      'review',
      'mergePull',
      'fork',
    ]) {
      await panel
        .getByLabel('Host action', { exact: true })
        .selectOption(action);
      if (action === 'createPull') {
        await panel.getByLabel('Title', { exact: true }).fill('Local draft');
        await panel.getByLabel('Head branch', { exact: true }).fill('feature');
      }
      if (['createPull', 'comment', 'review'].includes(action))
        await panel
          .getByLabel('Content', { exact: true })
          .fill('Local test content');
      if (action === 'review')
        await panel.getByLabel('Host action mode').selectOption('APPROVE');
      if (action === 'mergePull')
        await panel.getByLabel('Host action mode').selectOption('squash');
      await expect(publish).toBeDisabled();
      await panel.locator('.confirmation input').check();
      await publish.click();
      await expect(publish).toBeDisabled();
      await expect(panel.getByText('Contacting repository host…')).toHaveCount(
        0,
      );
      await expect(panel.getByRole('alert')).toHaveCount(0);
      await expect(panel.locator('.confirmation input')).not.toBeChecked();
    }
    const writes = requests.filter((r) => r.method !== 'GET');
    expect(writes.map((r) => r.method)).toEqual([
      'POST',
      'POST',
      'POST',
      'PUT',
      'POST',
    ]);
    expect(writes[0].body).toMatchObject({
      title: 'Local draft',
      head: 'feature',
      base: 'main',
      draft: true,
    });
    expect(writes[1].url).toBe(
      '/api/v3/repos/fixture/project/issues/7/comments',
    );
    expect(writes[2].body.event).toBe('APPROVE');
    expect(writes[3].body).toEqual({
      merge_method: 'squash',
      sha: pull.head.sha,
    });
    expect(writes[4].url).toBe('/api/v3/repos/fixture/project/forks');
    expect(writes.every((r) => r.authorization === `Bearer ${secret}`)).toBe(
      true,
    );
    await base.fill(`${prefix}/other`);
    await panel
      .getByRole('button', { name: 'Test connection', exact: true })
      .click();
    await expect(panel.getByRole('status')).toHaveText(
      'Connected as fixture-user.',
    );
    expect(requests.at(-1).authorization).toBeUndefined();
    await base.fill(`${prefix}/redirect`);
    await panel
      .getByRole('button', { name: 'Test connection', exact: true })
      .click();
    await expect(panel.getByRole('alert')).toContainText('302');
    expect(requests.some((r) => r.url === '/unexpected')).toBe(false);
    await page.screenshot({ path: join(evidence, 'hosts.png') });
  } finally {
    if (stored) {
      await page.getByLabel('API base URL', { exact: true }).fill(endpoint);
      await page
        .getByRole('button', { name: 'Remove token', exact: true })
        .click();
      await expect(
        page.locator('.host-panel').getByRole('status'),
      ).toContainText('Stored token removed.');
    }
    await new Promise((r) => server.close(r));
  }
}
