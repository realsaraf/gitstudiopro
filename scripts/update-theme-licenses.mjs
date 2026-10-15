// Maintenance helper: resolve upstream refs, preserve complete license text,
// and record exact source commits. Review changes before committing.
import { mkdir, writeFile } from 'node:fs/promises';
const sources = [
  ['catppuccin', 'catppuccin/catppuccin', 'main', 'LICENSE'],
  ['nord', 'nordtheme/nord', 'develop', 'license'],
  ['dracula', 'dracula/dracula-theme', 'main', 'LICENSE'],
  ['solarized', 'altercation/solarized', 'master', 'LICENSE'],
  ['gruvbox', 'gruvbox-community/gruvbox', 'master', 'LICENSE.md'],
  ['tokyo-night', 'folke/tokyonight.nvim', 'main', 'LICENSE'],
  ['rose-pine', 'rose-pine/rose-pine-theme', 'main', 'LICENSE'],
  ['one-dark', 'atom/one-dark-syntax', 'master', 'LICENSE.md'],
];
await mkdir('licenses', { recursive: true });
const manifest = [];
for (const [name, repo, ref, path] of sources) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/commits/${ref}`,
  );
  if (!response.ok) throw new Error(`${repo}: ${response.status}`);
  const { sha } = await response.json();
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
  const license = await fetch(url);
  if (!license.ok) throw new Error(`${url}: ${license.status}`);
  const content = await license.text();
  if (
    !content.includes('Permission is hereby granted') &&
    !content.includes('Apache License')
  )
    throw new Error(
      `Unexpected license for ${repo}. Review upstream manually.`,
    );
  await writeFile(`licenses/${name}.txt`, content);
  manifest.push({
    name,
    repository: `https://github.com/${repo}`,
    commit: sha,
    source: url,
    file: `licenses/${name}.txt`,
  });
  console.log(`${name}: preserved license from ${sha.slice(0, 12)}`);
}
await writeFile(
  'licenses/sources.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
