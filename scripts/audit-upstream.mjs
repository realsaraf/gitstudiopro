// Read-only inventory of upstream UI surfaces, not a source-code import.
// Usage: node scripts/audit-upstream.mjs /path/to/gitextensions
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '../gitextensions-reference');
const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const ui = join(root, 'src/app/GitUI');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : [join(dir, entry.name)],
      ),
    )
  ).flat();
}
const files = (await walk(ui)).filter((file) => file.endsWith('.cs')).sort();
const menuItems = [],
  dialogs = [],
  commandEntrypoints = [],
  dialogControls = [];
for (const file of files) {
  const source = relative(root, file).replaceAll('\\', '/');
  if (/\/Form[^/.]+\.cs$/.test(source)) dialogs.push(source);
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  lines.forEach((line, index) => {
    const text = line.match(/\b(\w+)\.Text = "((?:[^"\\]|\\.)*)";/);
    const entry = text && {
      source,
      line: index + 1,
      control: text[1],
      label: text[2].replaceAll('&', ''),
    };
    if (entry && /menuitem/i.test(entry.control)) menuItems.push(entry);
    if (
      entry &&
      /Form(Rebase|CherryPick|Commit|Stash|Push|Pull|MergeBranch|CheckoutBranch|Clone|CreateTag)\.Designer/.test(
        source,
      )
    )
      dialogControls.push(entry);
    if (source.endsWith('/GitUICommands.cs')) {
      const method = line.match(/public (?:async )?(?:[\w<>?]+) (\w+)\(/);
      if (method)
        commandEntrypoints.push({ source, line: index + 1, method: method[1] });
    }
  });
}
const inventory = {
  upstream: 'https://github.com/gitextensions/gitextensions',
  revision,
  scope:
    'Literal menu labels, top-level Form classes, public GitUICommands methods, and controls from selected operation dialogs. Dynamic menus, plugins and translated resources need manual follow-up. Counts are source surfaces, not independent features or parity percentages.',
  counts: {
    menuItems: menuItems.length,
    dialogs: dialogs.length,
    commandEntrypoints: commandEntrypoints.length,
    dialogControls: dialogControls.length,
  },
  menuItems,
  dialogs,
  commandEntrypoints,
  dialogControls,
};
await mkdir('docs/parity', { recursive: true });
await writeFile(
  'docs/parity/upstream-inventory.json',
  JSON.stringify(inventory, null, 2) + '\n',
);
console.log(JSON.stringify({ revision, ...inventory.counts }, null, 2));
