export interface PatchHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: { id: number; text: string }[];
}
export function editablePatch(patch: string): {
  header: string;
  hunks: PatchHunk[];
} {
  const lines = patch.split('\n');
  const header: string[] = [];
  const hunks: PatchHunk[] = [];
  let current: PatchHunk | undefined;
  let id = 0;
  for (const line of lines) {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (match) {
      current = {
        header: line,
        oldStart: Number(match[1]),
        newStart: Number(match[2]),
        lines: [],
      };
      hunks.push(current);
    } else if (current) {
      if (/^[ +\\-]/.test(line)) current.lines.push({ id: id++, text: line });
    } else header.push(line);
  }
  return { header: header.join('\n'), hunks };
}
/** Retain unselected changes as context on the side the patch will apply to. */
export function partialPatch(
  patch: string,
  selected: Set<number>,
  reverse = false,
): string {
  const parsed = editablePatch(patch);
  const output = [parsed.header];
  let delta = 0;
  for (const hunk of parsed.hunks) {
    if (
      !hunk.lines.some(
        (line) => selected.has(line.id) && /^[+-]/.test(line.text),
      )
    )
      continue;
    const lines: string[] = [];
    for (const line of hunk.lines) {
      const prefix = line.text[0];
      if (prefix === ' ' || prefix === '\\') lines.push(line.text);
      else if (selected.has(line.id)) lines.push(line.text);
      else if (prefix === (reverse ? '+' : '-'))
        lines.push(' ' + line.text.slice(1));
    }
    const oldCount = lines.filter((l) => l[0] === ' ' || l[0] === '-').length;
    const newCount = lines.filter((l) => l[0] === ' ' || l[0] === '+').length;
    const oldStart = reverse ? hunk.newStart - delta : hunk.oldStart;
    const newStart = reverse ? hunk.newStart : hunk.oldStart + delta;
    output.push(
      `@@ -${oldCount ? Math.max(1, oldStart) : oldStart},${oldCount} +${newCount ? Math.max(1, newStart) : newStart},${newCount} @@`,
      ...lines,
    );
    delta += newCount - oldCount;
  }
  return output.length === 1 ? '' : output.join('\n') + '\n';
}
