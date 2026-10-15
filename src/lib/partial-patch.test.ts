import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { editablePatch, partialPatch } from './partial-patch';
for (const reverse of [false, true])
  test(`${reverse ? 'unstages' : 'stages'} selected changes across multiple hunks using real Git`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'gitstudiopro-lines-'));
    const git = (args: string[], input?: string) =>
      execFileSync('git', ['-C', dir, ...args], {
        encoding: 'utf8',
        input,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    try {
      git(['init', '-b', 'main']);
      git(['config', 'user.name', 'Test']);
      git(['config', 'user.email', 'test@example.invalid']);
      git(['config', 'core.autocrlf', 'false']);
      git(['config', 'commit.gpgsign', 'false']);
      const before =
        Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n';
      writeFileSync(join(dir, 'file.txt'), before);
      git(['add', '.']);
      git(['commit', '-m', 'base']);
      const after = before
        .replace('line 1\n', 'changed 1\nextra\n')
        .replace('line 25\n', 'changed 25\n');
      writeFileSync(join(dir, 'file.txt'), after);
      if (reverse) git(['add', '.']);
      const diff = git([
        'diff',
        ...(reverse ? ['--cached'] : []),
        '--',
        'file.txt',
      ]);
      const parsed = editablePatch(diff);
      expect(parsed.hunks).toHaveLength(2);
      const selection = new Set(
        parsed.hunks[1].lines
          .filter((l) => /^[+-]/.test(l.text))
          .map((l) => l.id),
      );
      const patch = partialPatch(diff, selection, reverse);
      git(
        [
          'apply',
          '--cached',
          '--recount',
          '--unidiff-zero',
          ...(reverse ? ['--reverse'] : []),
        ],
        patch,
      );
      expect(git(['show', ':file.txt'])).toBe(
        reverse
          ? after.replace('changed 25\n', 'line 25\n')
          : before.replace('line 25\n', 'changed 25\n'),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
test('selects only an addition from a replacement', () => {
  const patch =
    'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,2 +1,2 @@\n-old\n+new\n tail\n';
  const parsed = editablePatch(patch);
  const selected = new Set(
    parsed.hunks[0].lines.filter((l) => l.text === '+new').map((l) => l.id),
  );
  expect(partialPatch(patch, selected)).toContain(' old\n+new\n tail\n');
});
