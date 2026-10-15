import { describe, expect, it } from 'vitest';
import { parseDiff, splitDiff } from './diff';
describe('unified patch parsing', () => {
  it('tracks independent old and new line numbers', () => {
    const lines = parseDiff(
      '--- a/file\n+++ b/file\n@@ -5,2 +7,3 @@\n-old\n+new\n+extra\n same\n',
    );
    expect(lines[3]).toEqual({ type: 'remove', text: 'old', old: 5 });
    expect(lines[4]).toEqual({ type: 'add', text: 'new', next: 7 });
    expect(lines[6]).toEqual({
      type: 'context',
      text: 'same',
      old: 6,
      next: 9,
    });
    const rows = splitDiff(lines);
    expect(rows[3].left?.text).toBe('old');
    expect(rows[3].right?.text).toBe('new');
    expect(rows[4].left).toBeUndefined();
    expect(rows[4].right?.next).toBe(8);
  });
  it('preserves content beginning with patch-like headers', () => {
    expect(parseDiff('@@ -0,0 +1,1 @@\n++++content\n')[1]).toEqual({
      type: 'add',
      text: '+++content',
      next: 1,
    });
  });
  it('keeps binary and no-newline markers out of the line count', () => {
    const lines = parseDiff('Binary files a/a and b/a differ\n');
    expect(lines[0].type).toBe('meta');
    const noNewline = parseDiff(
      '@@ -1 +1 @@\n-old\n\\ No newline at end of file\n+new\n',
    );
    expect(noNewline[2].type).toBe('meta');
    expect(noNewline[3].next).toBe(1);
  });
});
