import { launchNative } from './native-launch.mjs';
// End-to-end tests against the real Windows app. All tested Git actions go
// through UI controls. CLI commands only prepare fixtures/peer activity and
// independently verify results; no invoke mocks or backend calls are used.
import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

if (process.platform !== 'win32')
  throw new Error('Windows WebView2 is required.');
const root = await mkdtemp(join(tmpdir(), 'gitstudiopro-workflows-'));
const output = resolve('artifacts/native-workflows');
await mkdir(output, { recursive: true });
await rm(join(output, 'failure.png'), { force: true });
const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
async function init(name) {
  const dir = join(root, name);
  await mkdir(dir);
  git(dir, 'init', '-b', 'main');
  for (const [key, value] of Object.entries({
    'user.name': 'UI Test',
    'user.email': 'ui@example.invalid',
    'commit.gpgsign': 'false',
    'core.autocrlf': 'false',
    'core.hooksPath': '.git/no-hooks',
  }))
    git(dir, 'config', key, value);
  return dir;
}
async function seed(dir, file, content, message) {
  await writeFile(join(dir, file), content);
  git(dir, 'add', '--', file);
  git(dir, 'commit', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const work = await init('work');
await seed(work, 'base.txt', 'base\n', 'Initial fixture');
git(work, 'switch', '-c', 'source-pick');
const pickId = await seed(work, 'picked.txt', 'pick\n', 'Pick this change');
git(work, 'switch', 'main');
git(work, 'switch', '-c', 'source-merge');
await seed(work, 'merged.txt', 'merge\n', 'Merge this change');
git(work, 'switch', 'main');
const remote = join(root, 'origin.git');
await mkdir(remote);
git(remote, 'init', '--bare', '-b', 'main');
git(work, 'remote', 'add', 'origin', remote);
git(work, 'push', '-u', 'origin', 'main');
const peer = await init('peer');
git(peer, 'remote', 'add', 'origin', remote);
git(peer, 'fetch', 'origin');
git(peer, 'reset', '--hard', 'origin/main');
git(peer, 'switch', '-c', 'remote-only');
await seed(peer, 'remote.txt', 'remote\n', 'Remote-only change');
git(peer, 'push', '-u', 'origin', 'remote-only');
git(peer, 'switch', 'main');

const conflictFixtures = [];
for (const operation of ['rebase', 'cherry-pick', 'merge', 'revert']) {
  const dir = await init(`conflict-${operation}`);
  await seed(dir, 'conflict.txt', 'base\n', 'Base');
  git(dir, 'switch', '-c', 'target');
  const target = await seed(dir, 'conflict.txt', 'target\n', 'Target change');
  if (operation !== 'revert') git(dir, 'switch', 'main');
  await seed(dir, 'conflict.txt', 'local\n', 'Local change');
  conflictFixtures.push({
    dir,
    operation,
    target,
    before: git(dir, 'rev-parse', 'HEAD'),
  });
}

const executable = resolve(
  process.env.GITSTUDIO_BINARY ?? 'src-tauri/target/debug/gitstudiopro.exe',
);
// Allocate a free loopback port so another app's debugging endpoint is not reused.
const listener = createServer();
await new Promise((resolve, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', resolve);
});
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const app = launchNative(
  executable,
  {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    WEBVIEW2_USER_DATA_FOLDER: join(root, 'profile'),
  },
  output,
);
const results = [];
let browser;
let page;
let context;
async function step(name, fn) {
  const started = performance.now();
  await fn();
  results.push({
    name,
    passed: true,
    milliseconds: Math.round(performance.now() - started),
  });
  console.log(`PASS ${name}`);
}
const ui = () => page.locator('.tab-workspace:not([hidden])');
async function nav(name) {
  await ui()
    .getByRole('button', {
      name: name === 'Working changes' ? /^Working changes/ : name,
      exact: true,
    })
    .click();
}
async function refresh() {
  await ui()
    .getByRole('button', { name: 'Refresh repository', exact: true })
    .click();
}
async function submit(title) {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await dialog.getByRole('button', { name: title, exact: true }).click();
}
async function completed() {
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20000 });
}
async function openRepo(dir) {
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.getByLabel('Repository path').fill(dir);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Open repository', exact: true })
    .click();
  await completed();
  await ui().locator('.commit-row').first().waitFor();
}
async function menu(label, item) {
  await ui().getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}
async function switchBranch(name) {
  await nav('Branches');
  await ui()
    .locator(`[data-branch=${JSON.stringify(name)}]`)
    .getByRole('button', { name: 'Switch branch', exact: true })
    .click();
  await submit('Switch branch');
  await completed();
}
async function stageCommit(message) {
  await nav('Working changes');
  await refresh();
  await ui().getByRole('button', { name: 'Stage all', exact: true }).click();
  await expect(
    ui().getByRole('button', { name: 'Unstage all', exact: true }),
  ).toBeEnabled();
  await ui().getByLabel('Commit message').fill(message);
  await ui()
    .getByRole('button', { name: /^Commit \d+ files?$/ })
    .click();
  await expect(ui().getByLabel('Commit message')).toHaveValue('', {
    timeout: 20000,
  });
}
async function chooseCommit(id, action) {
  await nav('Commit history');
  await ui().getByLabel('Search loaded commits').fill(id);
  await ui()
    .locator('.commit-row')
    .filter({ has: page.getByText(id.slice(0, 7), { exact: true }) })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: action, exact: true }).click();
  await submit(action);
}
async function startConflict(fixture) {
  if (fixture.operation === 'rebase' || fixture.operation === 'merge') {
    await nav('Branches');
    const item =
      fixture.operation === 'rebase'
        ? 'Rebase current branch onto this'
        : 'Merge into current branch';
    await menu('Branch actions for target', item);
    await submit(
      fixture.operation === 'rebase' ? 'Rebase current branch' : item,
    );
  } else
    await chooseCommit(
      fixture.target,
      fixture.operation === 'revert' ? 'Revert commit' : 'Cherry-pick commit',
    );
  await completed();
  await expect(
    ui().getByRole('region', { name: 'Repository operation' }),
  ).toContainText(`${fixture.operation} in progress`);
}

try {
  browser = await app.connect(port);
  context = browser.contexts()[0];
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  for (let i = 0; i < 40; i++) {
    page = context.pages().find((p) => !p.url().startsWith('devtools:'));
    if (page && page.url() !== 'about:blank') break;
    await delay(250);
  }
  page.setDefaultTimeout(15000);
  await page.getByRole('button', { name: 'New tab', exact: true }).waitFor();
  await step('Open real repository', () => openRepo(work));
  await step('Create and switch branch using UI', async () => {
    await ui().getByRole('button', { name: 'New branch', exact: true }).click();
    await page.getByLabel('Branch name').fill('feature/ui');
    await submit('New branch');
    await completed();
    await switchBranch('feature/ui');
    expect(git(work, 'branch', '--show-current')).toBe('feature/ui');
  });
  await step('Stage, unstage, and commit multiple Unicode paths', async () => {
    await writeFile(join(work, 'base.txt'), 'UI change\n');
    await writeFile(join(work, 'space ü.txt'), 'Unicode\n');
    await nav('Working changes');
    await refresh();
    await ui().getByRole('button', { name: 'Stage all', exact: true }).click();
    await expect(
      ui().getByRole('button', { name: 'Unstage all', exact: true }),
    ).toBeEnabled();
    expect(git(work, 'diff', '--cached', '--name-only')).toContain('base.txt');
    await ui()
      .getByRole('button', { name: 'Unstage all', exact: true })
      .click();
    await expect
      .poll(() => git(work, 'diff', '--cached', '--name-only'))
      .toBe('');
    await stageCommit('UI feature commit');
    expect(git(work, 'log', '-1', '--format=%s')).toBe('UI feature commit');
  });
  await step('Publish branch and set upstream', async () => {
    await nav('Remotes');
    await ui()
      .getByRole('button', { name: 'Publish branch', exact: true })
      .click();
    await submit('Publish current branch');
    await completed();
    expect(git(work, 'rev-parse', '--abbrev-ref', '@{upstream}')).toBe(
      'origin/feature/ui',
    );
    expect(git(remote, 'rev-parse', 'refs/heads/feature/ui')).toBe(
      git(work, 'rev-parse', 'HEAD'),
    );
  });
  await step('Push a subsequent commit', async () => {
    await writeFile(join(work, 'push.txt'), 'push\n');
    await stageCommit('UI push commit');
    await nav('Remotes');
    await ui().getByRole('button', { name: 'Push', exact: true }).click();
    await submit('Push current branch');
    await completed();
    expect(git(remote, 'rev-parse', 'refs/heads/feature/ui')).toBe(
      git(work, 'rev-parse', 'HEAD'),
    );
  });
  await step('Cherry-pick selected commit through its menu', async () => {
    await switchBranch('main');
    await chooseCommit(pickId, 'Cherry-pick commit');
    await completed();
    expect(await readFile(join(work, 'picked.txt'), 'utf8')).toBe('pick\n');
    expect(git(work, 'log', '-1', '--format=%s')).toBe('Pick this change');
  });
  await step('Revert selected commit', async () => {
    await chooseCommit(git(work, 'rev-parse', 'HEAD'), 'Revert commit');
    await completed();
    expect(git(work, 'log', '-1', '--format=%s')).toContain('Revert');
    expect(git(work, 'ls-files', 'picked.txt')).toBe('');
  });
  await step('Merge branch through its menu', async () => {
    await nav('Branches');
    await menu('Branch actions for source-merge', 'Merge into current branch');
    await submit('Merge into current branch');
    await completed();
    git(work, 'merge-base', '--is-ancestor', 'source-merge', 'HEAD');
    expect(await readFile(join(work, 'merged.txt'), 'utf8')).toBe('merge\n');
  });
  await step('Rebase feature branch onto main', async () => {
    await switchBranch('feature/ui');
    const before = git(work, 'rev-parse', 'HEAD');
    await menu('Branch actions for main', 'Rebase current branch onto this');
    await submit('Rebase current branch');
    await completed();
    git(work, 'merge-base', '--is-ancestor', 'main', 'HEAD');
    expect(git(work, 'rev-parse', 'HEAD')).not.toBe(before);
    expect(await readFile(join(work, 'push.txt'), 'utf8')).toBe('push\n');
  });
  await step(
    'Divergent push is refused without overwriting remote',
    async () => {
      const before = git(remote, 'rev-parse', 'refs/heads/feature/ui');
      await nav('Remotes');
      await ui().getByRole('button', { name: 'Push', exact: true }).click();
      await submit('Push current branch');
      await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
        /rejected|non-fast-forward/,
      );
      expect(git(remote, 'rev-parse', 'refs/heads/feature/ui')).toBe(before);
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();
    },
  );
  await step(
    'Create branch at commit, rename, delete merged branch, and tag',
    async () => {
      const head = git(work, 'rev-parse', 'HEAD');
      await nav('Commit history');
      await ui().getByLabel('Search loaded commits').fill(head);
      await ui().locator('.commit-row').click();
      await menu('Commit actions', 'Create branch at commit');
      await page.getByLabel('Branch name').fill('temporary');
      await submit('Create branch at commit');
      await completed();
      await nav('Branches');
      await menu('Branch actions for temporary', 'Rename branch');
      await page.getByLabel('New branch name').fill('renamed');
      await submit('Rename branch');
      await completed();
      expect(git(work, 'rev-parse', 'renamed')).toBe(head);
      await menu('Branch actions for renamed', 'Delete merged branch');
      await submit('Delete merged branch');
      await completed();
      expect(git(work, 'branch', '--list', 'renamed')).toBe('');
      await nav('Commit history');
      await menu('Commit actions', 'Create tag');
      await page.getByLabel('Tag name').fill('ui-test');
      await submit('Create tag');
      await completed();
      expect(git(work, 'rev-parse', 'ui-test')).toBe(head);
    },
  );
  await step('Fetch and track remote branch', async () => {
    await nav('Remotes');
    await ui()
      .getByRole('button', { name: 'Fetch', exact: true })
      .last()
      .click();
    await expect(
      ui().getByRole('button', { name: 'Fetch', exact: true }).last(),
    ).toBeEnabled();
    await nav('Branches');
    const row = ui().locator('[data-branch="origin/remote-only"]');
    await row.getByRole('button', { name: 'Track branch' }).click();
    await page.getByLabel('Branch name').fill('tracked-remote');
    await submit('Track remote branch');
    await completed();
    expect(git(work, 'branch', '--show-current')).toBe('tracked-remote');
    expect(git(work, 'rev-parse', '--abbrev-ref', '@{upstream}')).toBe(
      'origin/remote-only',
    );
  });
  await step('Pull fast-forward from a local peer', async () => {
    git(peer, 'switch', 'remote-only');
    await seed(peer, 'peer.txt', 'peer\n', 'Peer update');
    git(peer, 'push');
    await nav('Remotes');
    await ui()
      .getByRole('button', { name: 'Pull · fast-forward only', exact: true })
      .click();
    await submit('Pull current branch');
    await completed();
    expect(await readFile(join(work, 'peer.txt'), 'utf8')).toBe('peer\n');
  });
  await step(
    'Save and apply stash, retain then explicitly drop it',
    async () => {
      await writeFile(join(work, 'saved.txt'), 'saved\n');
      await refresh();
      await ui().getByRole('button', { name: 'Stash', exact: true }).click();
      await page.getByLabel('Stash message').fill('UI saved work');
      await submit('Stash working changes');
      await completed();
      expect(git(work, 'status', '--porcelain')).toBe('');
      await nav('Stashes');
      await ui()
        .getByRole('button', { name: 'Apply stash', exact: true })
        .click();
      await submit('Apply stash');
      await completed();
      expect(await readFile(join(work, 'saved.txt'), 'utf8')).toBe('saved\n');
      expect(git(work, 'stash', 'list')).toContain('UI saved work');
      await stageCommit('Commit restored stash');
      await nav('Stashes');
      await ui()
        .getByRole('button', { name: /^Stash actions for/ })
        .click();
      await page
        .getByRole('menuitem', { name: 'Drop stash', exact: true })
        .click();
      await submit('Drop stash');
      await completed();
      expect(git(work, 'stash', 'list')).toBe('');
    },
  );
  await step('Pop stash applies and removes saved work', async () => {
    await writeFile(join(work, 'pop.txt'), 'pop\n');
    await refresh();
    await ui().getByRole('button', { name: 'Stash', exact: true }).click();
    await submit('Stash working changes');
    await completed();
    await ui()
      .getByRole('button', { name: /^Stash actions for/ })
      .click();
    await page
      .getByRole('menuitem', { name: 'Pop stash', exact: true })
      .click();
    await submit('Pop stash');
    await completed();
    expect(await readFile(join(work, 'pop.txt'), 'utf8')).toBe('pop\n');
    expect(git(work, 'stash', 'list')).toBe('');
    await stageCommit('Commit popped work');
  });
  for (const fixture of conflictFixtures) {
    await page.keyboard.press('Control+w');
    await openRepo(fixture.dir);
    await step(
      `${fixture.operation}: conflict detection and abort restores original HEAD`,
      async () => {
        await startConflict(fixture);
        await expect(
          ui().getByRole('button', {
            name: `Continue ${fixture.operation}`,
            exact: true,
          }),
        ).toBeDisabled();
        await expect(ui().getByLabel('Diff code')).toHaveAttribute(
          'aria-busy',
          'false',
        );
        await page.screenshot({
          path: join(output, `conflict-${fixture.operation}.png`),
        });
        await ui()
          .getByRole('button', {
            name: `Abort ${fixture.operation}`,
            exact: true,
          })
          .click();
        await submit(`Abort ${fixture.operation}`);
        await completed();
        await expect(
          ui().getByRole('region', { name: 'Repository operation' }),
        ).toHaveCount(0);
        expect(git(fixture.dir, 'rev-parse', 'HEAD')).toBe(fixture.before);
        expect(await readFile(join(fixture.dir, 'conflict.txt'), 'utf8')).toBe(
          'local\n',
        );
      },
    );
    await step(
      `${fixture.operation}: ${fixture.operation === 'cherry-pick' ? 'skip conflicted commit' : 'resolve, stage, continue'}`,
      async () => {
        await startConflict(fixture);
        if (fixture.operation === 'cherry-pick') {
          await ui()
            .getByRole('button', { name: 'Skip commit', exact: true })
            .click();
          await submit(`Skip ${fixture.operation} commit`);
          await completed();
          expect(git(fixture.dir, 'rev-parse', 'HEAD')).toBe(fixture.before);
        } else {
          // File editing represents the external-editor step offered by the UI.
          await writeFile(
            join(fixture.dir, 'conflict.txt'),
            'resolved through editor\n',
          );
          await refresh();
          await ui()
            .getByRole('button', { name: 'Stage conflict.txt', exact: true })
            .click();
          await expect(
            ui().getByRole('button', {
              name: `Continue ${fixture.operation}`,
              exact: true,
            }),
          ).toBeEnabled();
          await ui()
            .getByRole('button', {
              name: `Continue ${fixture.operation}`,
              exact: true,
            })
            .click();
        }
        await expect(
          ui().getByRole('region', { name: 'Repository operation' }),
        ).toHaveCount(0, { timeout: 20000 });
        expect(git(fixture.dir, 'status', '--porcelain')).toBe('');
      },
    );
  }
  console.log(`All ${results.length} native UI workflows passed.`);
} catch (error) {
  results.push({ name: 'Failure', passed: false, error: String(error) });
  if (page)
    await page
      .screenshot({ path: join(output, 'failure.png') })
      .catch(() => {});
  throw error;
} finally {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(
      {
        executable,
        fixture: root,
        results,
        passed: results.length > 0 && results.every((r) => r.passed),
      },
      null,
      2,
    ),
  );
  if (context)
    await context.tracing
      .stop({ path: join(output, 'trace.zip') })
      .catch(() => {});
  if (browser) await browser.close();
  app.kill();
  console.log(`Evidence: ${output}\nDisposable fixtures: ${root}`);
}
