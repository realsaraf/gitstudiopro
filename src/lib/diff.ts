export interface DiffLine {
  type: 'context' | 'add' | 'remove' | 'hunk' | 'meta';
  text: string;
  old?: number;
  next?: number;
}
export function parseDiff(patch: string): DiffLine[] {
  let old = 0,
    next = 0,
    inside = false;
  return patch
    .split('\n')
    .filter((text, i, lines) => i !== lines.length - 1 || text)
    .map((text) => {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
      if (hunk) {
        old = Number(hunk[1]);
        next = Number(hunk[2]);
        inside = true;
        return { type: 'hunk', text };
      }
      if (text.startsWith('diff --git')) inside = false;
      if (!inside || text.startsWith('\\')) return { type: 'meta', text };
      if (text.startsWith('+'))
        return { type: 'add', text: text.slice(1), next: next++ };
      if (text.startsWith('-'))
        return { type: 'remove', text: text.slice(1), old: old++ };
      if (text.startsWith(' '))
        return {
          type: 'context',
          text: text.slice(1),
          old: old++,
          next: next++,
        };
      return { type: 'meta', text };
    });
}
export function splitDiff(
  lines: DiffLine[],
): { left?: DiffLine; right?: DiffLine; full?: DiffLine }[] {
  const rows: { left?: DiffLine; right?: DiffLine; full?: DiffLine }[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (line.type === 'hunk' || line.type === 'meta') {
      rows.push({ full: line });
      i++;
    } else if (line.type === 'context') {
      rows.push({ left: line, right: line });
      i++;
    } else {
      const removed: DiffLine[] = [],
        added: DiffLine[] = [];
      while (
        i < lines.length &&
        (lines[i].type === 'remove' || lines[i].type === 'add')
      ) {
        (lines[i].type === 'remove' ? removed : added).push(lines[i++]);
      }
      for (let j = 0; j < Math.max(removed.length, added.length); j++)
        rows.push({ left: removed[j], right: added[j] });
    }
  }
  return rows;
}
