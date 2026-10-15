// Windows-only WebView2 smoke test. Uses a disposable repository and app profile.
// The release binary has no debug port unless explicitly enabled by this harness.
import { chromium, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
if (process.platform !== 'win32')
  throw new Error('This harness requires Windows WebView2.');
const fixture = await mkdtemp(join(tmpdir(), 'gitstudiopro-smoke-'));
const profile = await mkdtemp(join(tmpdir(), 'gitstudiopro-webview-'));
const git = (...args) =>
  execFileSync('git', ['-C', fixture, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
git('init', '-b', 'main');
git('config', 'user.name', 'GitStudio Test');
git('config', 'user.email', 'test@example.invalid');
git('config', 'commit.gpgsign', 'false');
git('config', 'core.hooksPath', '.git/no-hooks');
await writeFile(join(fixture, 'hello.txt'), 'hello\n');
git('add', 'hello.txt');
git('commit', '-m', 'Initial fixture');
await writeFile(join(fixture, 'hello.txt'), 'hello from the native app\n');
const executable = resolve(
  process.env.GITSTUDIO_BINARY ?? 'src-tauri/target/debug/gitstudiopro.exe',
);
const port = 9347;
const processHandle = spawn(executable, [], {
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    WEBVIEW2_USER_DATA_FOLDER: profile,
  },
});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      break;
    } catch {
      await setTimeout(500);
    }
  }
  if (!browser)
    throw new Error('Native WebView2 debug endpoint did not start.');
  let page;
  for (let i = 0; i < 40; i++) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => !p.url().startsWith('devtools:'));
    if (page && page.url() !== 'about:blank') break;
    await setTimeout(250);
  }
  if (!page) throw new Error('Native application page not found.');
  await page.keyboard.press('Control+k');
  await expect(page.getByLabel('Search commands')).toBeFocused();
  await page.keyboard.type('preferences');
  await expect(page.getByLabel('Search commands')).toHaveValue('preferences');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.getByLabel('Search commands')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Enter a repository path' }).click();
  await page.getByLabel('Repository path').fill(fixture);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Open repository', exact: true })
    .click();
  await expect(page.locator('.commit-row')).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator('.commit-row')).toContainText('Initial fixture');
  await expect(page.locator('.preview-badge')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Working changes', exact: false })
    .click();
  await page
    .getByRole('button', { name: 'Stage hello.txt', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Unstage hello.txt', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Commit message')
    .fill('Commit through native Tauri IPC');
  await page
    .getByRole('button', { name: 'Commit 1 file', exact: true })
    .click();
  await expect
    .poll(() => git('log', '-1', '--format=%s'))
    .toBe('Commit through native Tauri IPC');
  await page.getByRole('button', { name: 'New branch', exact: true }).click();
  await page.getByLabel('Branch name').fill('feature/native-test');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'New branch', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Branches', exact: true }).click();
  await page
    .getByRole('button', { name: 'Switch branch', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Switch branch', exact: true })
    .click();
  await expect
    .poll(() => git('branch', '--show-current'))
    .toBe('feature/native-test');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Commit history', exact: true })
    .click();
  await expect(page.locator('.commit-row')).toHaveCount(2);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/native-smoke.png' });
  const result = {
    platform: process.platform,
    executable,
    commits: git('rev-list', '--count', 'HEAD'),
    branch: git('branch', '--show-current'),
    content: await readFile(join(fixture, 'hello.txt'), 'utf8'),
    passed: true,
  };
  await writeFile(
    'artifacts/native-smoke.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (browser) await browser.close();
  processHandle.kill();
  // Retain the disposable fixture for failure diagnosis; no user data is touched.
  console.log(`Disposable fixture retained at ${fixture}`);
}
