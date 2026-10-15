import { launchNative } from './native-launch.mjs';
// Real desktop UI coverage for extended operations. CLI is fixture setup/assertion only.
import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { testHosts } from './native-hosts.mjs';
if (process.platform !== 'win32') throw new Error('Windows WebView2 required');
const root = await mkdtemp(join(tmpdir(), 'gitstudiopro-tools-'));
const evidence = resolve('artifacts/native-tools');
await mkdir(evidence, { recursive: true });
const git = (p, ...a) =>
  execFileSync('git', ['-C', p, ...a], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
async function fixture(name) {
  const p = join(root, name);
  await mkdir(p);
  git(p, 'init', '-b', 'main');
  for (const [k, v] of Object.entries({
    'user.name': 'Native Fixture',
    'user.email': 'native@example.invalid',
    'core.autocrlf': 'false',
    'commit.gpgsign': 'false',
    'core.hooksPath': '.git/no-hooks',
  }))
    git(p, 'config', k, v);
  await seed(
    p,
    'file.txt',
    'one\ntwo\nthree\n',
    'Initial fixture\n\nFull commit body',
  );
  return p;
}
async function seed(p, file, text, message) {
  await writeFile(join(p, file), text);
  git(p, 'add', '--', file);
  git(p, 'commit', '-m', message);
}
const work = await fixture('work');
const rebasing = await fixture('rebase');
await seed(rebasing, 'a.txt', 'a\n', 'First change');
await seed(rebasing, 'b.txt', 'b\n', 'Second change');
const conflict = await fixture('conflict');
git(conflict, 'switch', '-c', 'other');
await seed(conflict, 'file.txt', 'theirs\n', 'Other');
git(conflict, 'switch', 'main');
await seed(conflict, 'file.txt', 'ours\n', 'Ours');
const remote = join(root, 'origin.git');
await mkdir(remote);
git(remote, 'init', '--bare', '-b', 'main');
const listener = createServer();
await new Promise((r) => listener.listen(0, '127.0.0.1', r));
const port = listener.address().port;
await new Promise((r) => listener.close(r));
const executable = resolve(
  process.env.GITSTUDIO_BINARY ?? 'src-tauri/target/debug/gitstudiopro.exe',
);
const app = launchNative(
  executable,
  {
    ...process.env,
    // Local submodule fixtures only; never enable file transport in app defaults.
    GIT_ALLOW_PROTOCOL: 'file',
    WEBVIEW2_USER_DATA_FOLDER: join(root, 'profile'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
  },
  evidence,
);
let browser, page, context;
const results = [];
async function step(name, run) {
  if (
    process.env.NATIVE_TEST_FILTER &&
    !name.includes(process.env.NATIVE_TEST_FILTER)
  )
    return;
  await run();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
const ui = () => page.locator('.tab-workspace:not([hidden])');
async function open(p) {
  if (await page.getByRole('dialog').count())
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close dialog', exact: true })
      .click();
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.getByLabel('Repository path').fill(p);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Open repository', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ui()
    .getByRole('button', { name: 'Repository tools', exact: true })
    .waitFor();
}
async function choose(name) {
  if (!(await page.getByRole('dialog', { name: 'Repository tools' }).count()))
    await ui()
      .getByRole('button', { name: 'Repository tools', exact: true })
      .click();
  await page.getByLabel('Find Git tool').fill(name);
  await page
    .locator('.git-tools-nav')
    .getByRole('button', { name, exact: true })
    .click();
  return page.getByRole('region', { name, exact: true });
}
async function fields(region, values) {
  for (const [label, value] of Object.entries(values)) {
    const field = region.getByLabel(label, { exact: true });
    if (typeof value === 'boolean') {
      await field.setChecked(value);
    } else if ((await field.evaluate((e) => e.tagName)) === 'SELECT') {
      await field.selectOption(value);
    } else await field.fill(value);
  }
}
async function run(name, values = {}, write = false) {
  const region = await choose(name);
  await fields(region, values);
  if (write) await region.locator('.confirmation input').check();
  await region
    .getByRole('button', { name: write ? name : 'Inspect', exact: true })
    .click();
  await expect(
    region.getByRole('button', { name: write ? name : 'Inspect', exact: true }),
  ).toBeVisible();
  await expect(
    region.getByRole('region', { name: 'Operation result' }),
  ).toBeVisible();
  await expect(region.getByRole('alert')).toHaveCount(0);
  return region;
}
try {
  browser = await app.connect(port);
  context = browser.contexts()[0];
  await context.tracing.start({ screenshots: true, snapshots: true });
  for (let i = 0; i < 100; i++) {
    page = context.pages().find((p) => !p.url().startsWith('devtools:'));
    if (page && page.url() !== 'about:blank') break;
    await delay(200);
  }
  page.setDefaultTimeout(20000);
  await open(work);
  await step(
    'Inspect full message, tree, blame, file history and reflog',
    async () => {
      let r = await run('Full commit details', { Revision: 'HEAD' });
      await expect(r).toContainText('Full commit body');
      for (const [name, values, text] of [
        ['Browse revision tree', { Revision: 'HEAD' }, 'file.txt'],
        [
          'Blame file',
          { 'File path': 'file.txt', Revision: 'HEAD' },
          'Native Fixture',
        ],
        ['File history', { 'File path': 'file.txt' }, 'Full commit body'],
        ['Browse reflog', {}, 'commit'],
      ]) {
        r = await run(name, values);
        await expect(r).toContainText(text);
      }
    },
  );
  await step('Add, edit, rename and remove remote using tools', async () => {
    await run(
      'Add remote',
      { 'Remote name': 'temporary', 'URL or path': remote },
      true,
    );
    await run('Remove remote', { Remote: 'temporary' }, true);
    expect(git(work, 'remote')).not.toContain('temporary');
    await run(
      'Add remote',
      { 'Remote name': 'origin', 'URL or path': remote },
      true,
    );
    expect(git(work, 'remote', 'get-url', 'origin')).toBe(remote);
    await run(
      'Rename remote',
      { Remote: 'origin', 'New remote name': 'upstream' },
      true,
    );
    await run(
      'Edit remote URL',
      { Remote: 'upstream', 'URL or path': remote, 'Set push URL': true },
      true,
    );
    await run(
      'Rename remote',
      { Remote: 'upstream', 'New remote name': 'origin' },
      true,
    );
  });
  await step(
    'Publish with options, fetch all, configure upstream and fast-forward pull',
    async () => {
      await run(
        'Push with options',
        {
          Remote: 'origin',
          'Destination branch': 'main',
          'Push mode': 'normal',
          'Set upstream': true,
        },
        true,
      );
      expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(
        git(work, 'rev-parse', 'HEAD'),
      );
      await run(
        'Fetch with options',
        {
          Remote: '',
          'Prune stale tracking refs': true,
          'Fetch all tags': true,
        },
        true,
      );
      await run('Unset branch upstream', { 'Local branch': 'main' }, true);
      await run(
        'Set branch upstream',
        { 'Local branch': 'main', 'Upstream branch': 'origin/main' },
        true,
      );
      await run(
        'Pull with options',
        { Remote: 'origin', 'Remote branch': 'main', Integration: 'ff' },
        true,
      );
    },
  );
  await step(
    'Annotated tags publish and delete locally and remotely',
    async () => {
      await run(
        'Create annotated or signed tag',
        {
          'Tag name': 'v-test',
          Revision: 'HEAD',
          'Tag type': 'annotated',
          'Tag message': 'Native release',
        },
        true,
      );
      expect(git(work, 'cat-file', '-t', 'refs/tags/v-test')).toBe('tag');
      await run('Push tag', { Remote: 'origin', 'Tag name': 'v-test' }, true);
      await run(
        'Delete remote tag',
        { Remote: 'origin', 'Tag name': 'v-test' },
        true,
      );
      await run('Delete local tag', { 'Tag name': 'v-test' }, true);
      expect(git(work, 'tag', '--list')).toBe('');
    },
  );
  await step(
    'Edit ignore file and manage commit notes and local configuration',
    async () => {
      let r = await choose('Edit repository files');
      await fields(r, { 'Repository file': '.gitignore' });
      await r.getByRole('button', { name: 'Load for review' }).click();
      await r.getByLabel('File contents').fill('cache/\n');
      await r.locator('.confirmation input').check();
      await r.getByRole('button', { name: 'Save file', exact: true }).click();
      await expect(
        r.getByRole('region', { name: 'Operation result' }),
      ).toBeVisible();
      expect(await readFile(join(work, '.gitignore'), 'utf8')).toBe('cache/\n');
      await run(
        'Save commit note',
        { Revision: 'HEAD', Note: 'Reviewed natively' },
        true,
      );
      r = await run('Read commit note', { Revision: 'HEAD' });
      await expect(r).toContainText('Reviewed natively');
      await run(
        'Set Git configuration',
        {
          'Configuration key': 'rerere.enabled',
          Scope: 'local',
          Value: 'true',
        },
        true,
      );
      expect(git(work, 'config', '--local', 'rerere.enabled')).toBe('true');
    },
  );
  await step(
    'Stage and unstage selected lines while preserving other edits',
    async () => {
      await writeFile(join(work, 'file.txt'), 'ONE\ntwo\nTHREE\n');
      let r = await choose('Stage selected lines');
      await fields(r, { 'File path': 'file.txt' });
      await r.getByRole('button', { name: 'Load for review' }).click();
      await r.getByRole('checkbox', { name: /Select line .*: -one$/ }).check();
      await r.getByRole('checkbox', { name: /Select line .*: \+ONE$/ }).check();
      await r.locator('.confirmation input').check();
      await r
        .getByRole('button', { name: 'Stage selected lines', exact: true })
        .click();
      await expect(
        r.getByRole('region', { name: 'Operation result' }),
      ).toBeVisible();
      expect(git(work, 'show', ':file.txt')).toBe('ONE\ntwo\nthree');
      await r.getByLabel('Unstage from the index').check();
      await r.getByRole('button', { name: 'Load for review' }).click();
      await r.getByRole('button', { name: 'Toggle hunk 1' }).click();
      await r.locator('.confirmation input').check();
      await r
        .getByRole('button', { name: 'Unstage selected lines', exact: true })
        .click();
      await expect(
        r.getByRole('region', { name: 'Operation result' }),
      ).toBeVisible();
      expect(git(work, 'diff', '--cached')).toBe('');
    },
  );
  await step(
    'Discard tracked edits and preview then clean only selected untracked file',
    async () => {
      await run('Discard file changes', { 'File path': 'file.txt' }, true);
      await writeFile(join(work, 'scratch.txt'), 'scratch');
      let r = await run('Preview untracked cleanup', {
        'File path': 'scratch.txt',
      });
      await expect(r).toContainText('scratch.txt');
      await run('Clean untracked files', { 'File path': 'scratch.txt' }, true);
      expect(git(work, 'status', '--porcelain')).toContain('.gitignore');
    },
  );
  await step('Amend and reset from reviewed controls', async () => {
    git(work, 'add', '.gitignore');
    await run(
      'Amend last commit',
      { 'Replacement commit message': 'Amended through UI' },
      true,
    );
    expect(git(work, 'log', '-1', '--format=%s')).toBe('Amended through UI');
    await seed(work, 'later.txt', 'later', 'Later fixture');
    await run(
      'Reset current branch',
      { Revision: 'HEAD~1', 'Reset mode': 'soft' },
      true,
    );
    expect(git(work, 'diff', '--cached', '--name-only')).toBe('later.txt');
    await run(
      'Reset current branch',
      { Revision: 'HEAD', 'Reset mode': 'hard' },
      true,
    );
    expect(git(work, 'status', '--porcelain')).toBe('');
  });
  await step('Worktree add/list/remove', async () => {
    const linked = join(root, 'linked');
    await run(
      'Add worktree',
      {
        'Destination path': linked,
        'Branch name': 'linked',
        'Create new branch': true,
      },
      true,
    );
    expect(git(linked, 'branch', '--show-current')).toBe('linked');
    let r = await run('List worktrees');
    await expect(r).toContainText('linked');
    await run('Remove worktree', { 'Worktree path': linked }, true);
    expect(git(work, 'worktree', 'list')).not.toContain('[linked]');
  });
  await step('Export patches and archive a revision', async () => {
    await seed(work, 'patch.txt', 'patch\n', 'Patch fixture');
    let r = await run('Export mail patches', {
      'Base revision': 'HEAD~1',
      'Head revision': 'HEAD',
    });
    await expect(r).toContainText('Subject: [PATCH]');
    const zip = join(root, 'repo.zip');
    await run(
      'Archive revision',
      { Revision: 'HEAD', 'Absolute ZIP path': zip },
      true,
    );
    expect((await readFile(zip)).subarray(0, 2).toString()).toBe('PK');
  });
  await step(
    'Interactive rebase squashes commits through visual plan',
    async () => {
      await open(rebasing);
      let r = await choose('Interactive rebase');
      await fields(r, { 'Upstream revision': 'HEAD~2' });
      await r.getByRole('button', { name: 'Load for review' }).click();
      await r
        .getByLabel('Action for Second change', { exact: true })
        .selectOption('fixup');
      await r.locator('.confirmation input').check();
      await r
        .getByRole('button', { name: 'Start interactive rebase', exact: true })
        .click();
      await expect(
        r.getByRole('region', { name: 'Operation result' }),
      ).toBeVisible();
      await expect(r.getByRole('alert')).toHaveCount(0);
      expect(git(rebasing, 'rev-list', '--count', 'HEAD')).toBe('2');
      expect(git(rebasing, 'ls-tree', '--name-only', 'HEAD')).toContain(
        'b.txt',
      );
    },
  );
  await step(
    'Interactive edit pauses, amends and continues through the UI',
    async () => {
      await seed(rebasing, 'c.txt', 'c\n', 'Editable change');
      let r = await choose('Interactive rebase');
      await fields(r, { 'Upstream revision': 'HEAD~1' });
      await r.getByRole('button', { name: 'Load for review' }).click();
      await r
        .getByLabel('Action for Editable change', { exact: true })
        .selectOption('edit');
      await r.locator('.confirmation input').check();
      await r
        .getByRole('button', { name: 'Start interactive rebase', exact: true })
        .click();
      await expect(
        r.getByRole('region', { name: 'Operation result' }),
      ).toBeVisible();
      await run(
        'Amend last commit',
        { 'Replacement commit message': 'Edited through rebase' },
        true,
      );
      await page
        .getByRole('button', { name: 'Close dialog', exact: true })
        .click();
      await ui()
        .getByRole('button', { name: 'Continue rebase', exact: true })
        .click();
      await expect(
        ui().getByRole('region', { name: 'Repository operation' }),
      ).toHaveCount(0);
      expect(git(rebasing, 'log', '-1', '--format=%s')).toBe(
        'Edited through rebase',
      );
      expect(git(rebasing, 'branch', '--show-current')).toBe('main');
    },
  );
  await step(
    'Sparse checkout and bisect controls preserve repository state',
    async () => {
      const p = await fixture('sparse-bisect');
      await mkdir(join(p, 'included'));
      await mkdir(join(p, 'excluded'));
      await seed(p, 'included/a.txt', 'a\n', 'Included');
      await seed(p, 'excluded/b.txt', 'b\n', 'Excluded');
      await open(p);
      await run(
        'Configure sparse checkout',
        { 'Directories (one per line)': 'included' },
        true,
      );
      expect(git(p, 'sparse-checkout', 'list')).toBe('included');
      await run('Show sparse checkout');
      await run('Disable sparse checkout', {}, true);
      expect(await readFile(join(p, 'excluded/b.txt'), 'utf8')).toBe('b\n');
      const original = git(p, 'rev-parse', 'HEAD');
      await run(
        'Start bisect',
        { 'Bad revision': 'HEAD', 'Good revision': 'HEAD~2' },
        true,
      );
      await run('Bisect status');
      await run('Mark good in bisect', {}, true);
      await run('Finish bisect', {}, true);
      expect(git(p, 'rev-parse', 'HEAD')).toBe(original);
      expect(git(p, 'branch', '--show-current')).toBe('main');
    },
  );
  await step(
    'Submodule add, commit, sync, deinitialize and initialize',
    async () => {
      const p = await fixture('submodules');
      await open(p);
      await run(
        'Add submodule',
        { 'Submodule URL': work, 'Relative directory': 'library' },
        true,
      );
      await run(
        'Commit with author and signing options',
        {
          'Commit message': 'Add library',
          'Author (Name <email>)': 'UI Author <author@example.invalid>',
          'Add Signed-off-by trailer': true,
        },
        true,
      );
      expect(git(p, 'log', '-1', '--format=%an')).toBe('UI Author');
      await run('Submodule status');
      await run('Sync submodule URLs', { 'File path': 'library' }, true);
      await run('Deinitialize submodule', { 'File path': 'library' }, true);
      expect(git(p, 'submodule', 'status')).toMatch(/^-/);
      await run('Update submodules', { 'File path': 'library' }, true);
      expect(git(join(p, 'library'), 'rev-parse', 'HEAD')).toBe(
        git(work, 'rev-parse', 'HEAD'),
      );
      expect(git(p, 'status', '--porcelain')).toBe('');
    },
  );
  await step(
    'Custom executable presets pass arguments literally and persist',
    async () => {
      await open(work);
      const script = join(root, 'custom-tool.mjs');
      await writeFile(
        script,
        'setTimeout(() => console.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})), 1000);',
      );
      const r = await choose('Run custom tool or script');
      await fields(r, {
        'Absolute executable path': process.execPath,
        'Arguments (one per line)': `${script}\nliteral & | $() text`,
      });
      await r.getByLabel('Preset name', { exact: true }).fill('Fixture tool');
      await r.getByRole('button', { name: 'Save tool preset' }).click();
      await r.getByLabel('Absolute executable path', { exact: true }).fill('');
      await r
        .getByLabel('Saved tool', { exact: true })
        .selectOption('Fixture tool');
      await expect(
        r.getByLabel('Absolute executable path', { exact: true }),
      ).toHaveValue(process.execPath);
      await r.locator('.confirmation input').check();
      await r
        .getByRole('button', { name: 'Run custom tool or script', exact: true })
        .click();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: 'Repository tools' }),
      ).toBeVisible();
      const output = r.getByRole('region', { name: 'Operation result' });
      await expect(output).toContainText('literal & | $() text');
      await expect(r.getByRole('alert')).toHaveCount(0);
      await r
        .getByRole('button', { name: 'Remove preset', exact: true })
        .click();
    },
  );
  await step(
    'Built-in conflict editor saves, stages and continues a real merge',
    async () => {
      await open(conflict);
      let r = await choose('Merge with options');
      await fields(r, { Revision: 'other', 'Merge mode': 'no-ff' });
      await r.locator('.confirmation input').check();
      await r
        .getByRole('button', { name: 'Merge with options', exact: true })
        .click();
      await expect(r.getByRole('alert')).toBeVisible();
      r = await choose('Resolve file conflict');
      await fields(r, { 'File path': 'file.txt' });
      await r.getByRole('button', { name: 'Load for review' }).click();
      await r.getByLabel('Resolved file contents').fill('resolved in UI\n');
      await r.locator('.confirmation input').check();
      await r.getByRole('button', { name: 'Save file', exact: true }).click();
      await expect(
        r.getByRole('region', { name: 'Operation result' }),
      ).toBeVisible();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Close dialog', exact: true })
        .click();
      await ui()
        .getByRole('button', { name: /^Working changes/ })
        .click();
      await ui()
        .getByRole('button', { name: 'Stage file.txt', exact: true })
        .click();
      await ui()
        .getByRole('button', { name: 'Continue merge', exact: true })
        .click();
      await expect(
        ui().getByRole('region', { name: 'Repository operation' }),
      ).toHaveCount(0);
      expect(await readFile(join(conflict, 'file.txt'), 'utf8')).toBe(
        'resolved in UI\n',
      );
    },
  );
  await step(
    'Clone and initialize repositories through creation dialog',
    async () => {
      for (const mode of ['init', 'clone']) {
        await page.keyboard.press('Control+k');
        await page.getByLabel('Search commands').fill('clone or initialize');
        await page.keyboard.press('Enter');
        const d = page.getByRole('dialog', {
          name: 'Clone or initialize repository',
        });
        await d.getByLabel('Operation', { exact: true }).selectOption(mode);
        const dest = join(root, `ui-${mode}`);
        await d.getByLabel('New destination path').fill(dest);
        if (mode === 'clone')
          await d.getByLabel('Source URL or path').fill(work);
        await d
          .getByRole('button', {
            name:
              mode === 'init' ? 'Initialize repository' : 'Clone repository',
            exact: true,
          })
          .click();
        await expect(d).toHaveCount(0);
        expect(git(dest, 'rev-parse', '--is-inside-work-tree')).toBe('true');
      }
    },
  );
  await step(
    'Host UI reads, publishes to a loopback fixture, isolates credentials and blocks redirects',
    () => testHosts(page, evidence),
  );
  await open(work);
  await choose('Interactive rebase');
  await page.screenshot({ path: join(evidence, 'tools.png') });
  console.log(`All ${results.length} advanced UI scenarios passed.`);
} catch (e) {
  results.push({ name: 'Failure', passed: false, error: String(e) });
  if (page)
    await page
      .screenshot({ path: join(evidence, 'failure.png') })
      .catch(() => {});
  throw e;
} finally {
  await writeFile(
    join(evidence, 'results.json'),
    JSON.stringify(
      {
        executable,
        fixture: root,
        filter: process.env.NATIVE_TEST_FILTER ?? null,
        passed: results.every((r) => r.passed),
        results,
      },
      null,
      2,
    ),
  );
  if (context)
    await context.tracing
      .stop({ path: join(evidence, 'trace.zip') })
      .catch(() => {});
  if (browser) await browser.close();
  app.kill();
  console.log(`Evidence: ${evidence}`);
}
