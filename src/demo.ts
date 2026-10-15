import type { Commit, Snapshot } from './types';
export const demoRepo = {
  path: '/demo/gitstudiopro',
  name: 'gitstudiopro',
  branch: 'feature/workspace',
};
const messages = [
  'Polish the workspace, one detail at a time',
  'Add keyboard navigation to the command palette',
  "Merge branch 'feature/commit-graph' into main",
  'Keep commit graph lanes stable across merges',
  'Remember panel sizes between sessions',
  'Add side-by-side diff and line numbers',
  'Improve contrast for every bundled theme',
  'Read repository status on a background thread',
  'Handle renamed files and paths with spaces',
  'Add integration tests for the Git service',
  'Document the architecture and contribution workflow',
  'A new home for your repositories',
];
const id = (n: number) =>
  [
    'a7e20f1',
    'b9d43c2',
    'c32e8a0',
    'd18f602',
    'e74a391',
    'f026bd4',
    '08bc3e7',
    '16c8af2',
    '29f017a',
    '3cd8e40',
    '4e019fc',
    '5f7a2d0',
  ][n].padEnd(40, '0');
export const demoCommits: Commit[] = messages.map((subject, i) => ({
  id: id(i),
  parents:
    i === 11 ? [] : i === 2 ? [id(4), id(3)] : i === 3 ? [id(5)] : [id(i + 1)],
  author: ['Alex Morgan', 'Sam Rivera', 'Jamie Chen'][i % 3],
  email: 'contributor@example.invalid',
  timestamp: 1781452800 - i * 7200,
  subject,
  refs:
    i === 0
      ? ['HEAD -> feature/workspace']
      : i === 2
        ? ['main', 'origin/main']
        : i === 5
          ? ['tag: v0.1.0-alpha']
          : i === 3
            ? ['feature/commit-graph']
            : [],
}));
export const demoSnapshot: Snapshot = {
  branch: 'feature/workspace',
  files: [
    { path: 'src/components/Workspace.tsx', index: ' ', worktree: 'M' },
    { path: 'src/styles.css', index: 'M', worktree: ' ' },
    { path: 'docs/architecture.md', index: '?', worktree: '?' },
  ],
  branches: [
    { name: 'feature/workspace', current: true, remote: false, upstream: '' },
    { name: 'main', current: false, remote: false, upstream: 'origin/main' },
    {
      name: 'feature/commit-graph',
      current: false,
      remote: false,
      upstream: '',
    },
    { name: 'origin/main', current: false, remote: true, upstream: '' },
  ],
  remotes: [
    { name: 'origin', url: 'https://github.com/realsaraf/gitstudiopro.git' },
  ],
  stashes: [
    { index: 0, message: 'On feature/workspace: explore compact history rows' },
  ],
};
export const demoFiles = [
  { path: 'src/components/Workspace.tsx', index: 'M', worktree: ' ' },
  { path: 'src/styles.css', index: 'M', worktree: ' ' },
  { path: 'src/lib/graph.ts', index: 'A', worktree: ' ' },
  { path: 'docs/architecture.md', index: 'M', worktree: ' ' },
];
export const demoDiff = `diff --git a/src/components/Workspace.tsx b/src/components/Workspace.tsx
--- a/src/components/Workspace.tsx
+++ b/src/components/Workspace.tsx
@@ -18,11 +18,15 @@ export function Workspace() {
   const repository = useRepository();
   const [selection, setSelection] = useState(null);
${' '}
-  const history = loadHistory(repository);
+  const history = useCommitHistory(repository, {
+    pageSize: 150,
+    order: 'topological',
+  });
${' '}
   return (
     <WorkspaceLayout>
       <CommitHistory commits={history.commits} />
+      <PanelDivider accessible persist="history" />
       <CommitDetails selection={selection} />
     </WorkspaceLayout>
   );
`;
