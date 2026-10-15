/** Searchable UI definitions for the typed native Git operation allowlist. */
export type ToolAction =
  | 'runScript'
  | 'branchForceDelete'
  | 'commitOptions'
  | 'historySearch'
  | 'externalDiff'
  | 'externalMerge'
  | 'configList'
  | 'commitDetails'
  | 'tree'
  | 'showFile'
  | 'fileHistory'
  | 'blame'
  | 'reflog'
  | 'compareDiff'
  | 'remoteAdd'
  | 'remoteEdit'
  | 'remoteRename'
  | 'remoteRemove'
  | 'setUpstream'
  | 'unsetUpstream'
  | 'fetchOptions'
  | 'pullOptions'
  | 'pushOptions'
  | 'deleteRemoteBranch'
  | 'tags'
  | 'tagCreate'
  | 'tagDelete'
  | 'tagPush'
  | 'tagDeleteRemote'
  | 'checkoutRevision'
  | 'reset'
  | 'discard'
  | 'cleanPreview'
  | 'clean'
  | 'amend'
  | 'fixup'
  | 'mergeOptions'
  | 'rebaseOptions'
  | 'rebasePlan'
  | 'interactiveRebase'
  | 'pickOptions'
  | 'revertOptions'
  | 'stashOptions'
  | 'stashShow'
  | 'stashBranch'
  | 'worktrees'
  | 'worktreeAdd'
  | 'worktreeRemove'
  | 'worktreePrune'
  | 'submodules'
  | 'submoduleAdd'
  | 'submoduleUpdate'
  | 'submoduleSync'
  | 'submoduleDeinit'
  | 'sparseShow'
  | 'sparseSet'
  | 'sparseDisable'
  | 'bisectStatus'
  | 'bisectStart'
  | 'bisectGood'
  | 'bisectBad'
  | 'bisectSkip'
  | 'bisectReset'
  | 'notesShow'
  | 'notesSave'
  | 'notesRemove'
  | 'configRead'
  | 'configWrite'
  | 'editorRead'
  | 'editorSave'
  | 'conflictRead'
  | 'conflictSave'
  | 'conflictChoose'
  | 'patchPreview'
  | 'patchApply'
  | 'patchExport'
  | 'mailApply'
  | 'mailContinue'
  | 'mailAbort'
  | 'archive'
  | 'verify'
  | 'garbageCollect'
  | 'recoverObjects'
  | 'statistics'
  | 'largeFiles'
  | 'hunkDiff'
  | 'hunkApply';
export interface ToolValues {
  target: string;
  secondary: string;
  message: string;
  mode: string;
  flag: boolean;
  extra: boolean;
}
export interface ToolRequest extends ToolValues {
  action: ToolAction;
  confirmed: boolean;
}
export interface ToolResult {
  text: string;
  id?: string;
  base?: string;
  ours?: string;
  theirs?: string;
}
export interface ToolContext {
  revision: string;
  file: string;
  branch: string;
  remote: string;
}
export interface ToolField {
  key: keyof ToolValues;
  label: string;
  options?: string[];
  initial?: string | boolean;
  optional?: boolean;
  multiline?: boolean;
  context?: keyof ToolContext;
}
export interface GitTool {
  id: ToolAction;
  name: string;
  group: string;
  description: string;
  fields: ToolField[];
  read?: boolean;
  danger?: boolean;
  editor?: 'file' | 'conflict' | 'rebase' | 'hunks';
}
const field = (
  key: keyof ToolValues,
  label: string,
  options?: string[],
  initial?: string | boolean,
): ToolField => ({ key, label, options, initial });
const target = (label: string, context?: keyof ToolContext): ToolField => ({
  key: 'target',
  label,
  context,
});
const secondary = (label: string, initial = ''): ToolField => ({
  key: 'secondary',
  label,
  initial,
});
const revision = target('Revision', 'revision');
const file = target('File path', 'file');
const remote = target('Remote', 'remote');
const branch = target('Local branch', 'branch');
const message = (label = 'Message'): ToolField => ({
  key: 'message',
  label,
  multiline: true,
});
const flag = (label: string): ToolField =>
  field('flag', label, undefined, false);
const extra = (label: string): ToolField =>
  field('extra', label, undefined, false);
const mode = (label: string, options: string[]): ToolField =>
  field('mode', label, options, options[0]);
const optional = (f: ToolField): ToolField => ({ ...f, optional: true });
const tool = (
  id: ToolAction,
  name: string,
  group: string,
  description: string,
  fields: ToolField[] = [],
  options: Partial<GitTool> = {},
): GitTool => ({ id, name, group, description, fields, ...options });
export const gitTools: GitTool[] = [
  tool(
    'runScript',
    'Run custom tool or script',
    'Extensions',
    'Run an explicitly selected executable in this repository. Arguments are passed directly, one per line. For scripts, select the interpreter and pass the script path as an argument. Only run programs you trust.',
    [
      target('Absolute executable path'),
      {
        key: 'secondary',
        label: 'Arguments (one per line)',
        multiline: true,
        optional: true,
      },
    ],
    { danger: true },
  ),
  tool(
    'branchForceDelete',
    'Force delete local branch',
    'Branches',
    'Delete a local branch even if its commits are not merged. Git refuses deletion of a checked-out branch.',
    [branch],
    { danger: true },
  ),
  tool(
    'commitOptions',
    'Commit with author and signing options',
    'Working files',
    'Commit staged changes with an optional author/date override, sign-off and configured signing.',
    [
      optional(target('Author (Name <email>)')),
      optional(secondary('Author date (ISO 8601)')),
      message('Commit message'),
      flag('Add Signed-off-by trailer'),
      extra('Sign commit'),
    ],
  ),
  tool(
    'historySearch',
    'Search repository history',
    'Inspect',
    'Search across all refs, beyond loaded history rows. Returns up to 500 matching commits with full messages.',
    [
      optional(target('Author filter')),
      optional(secondary('Message text')),
      optional(message('File path')),
    ],
    { read: true },
  ),
  tool(
    'externalDiff',
    'Open external diff tool',
    'Working files',
    'Open the file in your configured Git difftool. The operation waits for the tool, up to the standard timeout.',
    [file, flag('Compare staged changes')],
  ),
  tool(
    'externalMerge',
    'Open external merge tool',
    'Working files',
    'Launch your configured Git mergetool for the selected conflict. Review the result before continuing the operation.',
    [file],
  ),
  tool(
    'configList',
    'Inspect Git configuration',
    'Configuration',
    'Read settings and their source files at the selected scope.',
    [mode('Scope', ['local', 'global'])],
    { read: true },
  ),
  tool(
    'commitDetails',
    'Full commit details',
    'Inspect',
    'Read the complete message, author, committer and dates.',
    [revision],
    { read: true },
  ),
  tool(
    'tree',
    'Browse revision tree',
    'Inspect',
    'List every file and object size in a committed tree.',
    [revision],
    { read: true },
  ),
  tool(
    'showFile',
    'Read file at revision',
    'Inspect',
    'Read a file from a commit without checking it out.',
    [revision, secondary('File path')],
    { read: true },
  ),
  tool(
    'fileHistory',
    'File history',
    'Inspect',
    'Follow renames through the latest 200 commits affecting a file.',
    [file],
    { read: true },
  ),
  tool(
    'blame',
    'Blame file',
    'Inspect',
    'Show the last author and commit for each line, ignoring whitespace.',
    [file, secondary('Revision', 'HEAD')],
    { read: true },
  ),
  tool(
    'reflog',
    'Browse reflog',
    'Inspect',
    'Inspect 300 recent reference movements, including previous HEAD positions.',
    [],
    { read: true },
  ),
  tool(
    'compareDiff',
    'Compare revision diffs',
    'Inspect',
    'Inspect the complete text patch between two committed trees.',
    [
      target('Base revision'),
      secondary('Head revision', 'HEAD'),
      flag('Ignore whitespace'),
      extra('Word diff'),
    ],
    { read: true },
  ),
  tool(
    'remoteAdd',
    'Add remote',
    'Remotes',
    'Register a remote URL or local repository path.',
    [target('Remote name'), secondary('URL or path')],
  ),
  tool(
    'remoteEdit',
    'Edit remote URL',
    'Remotes',
    'Replace the fetch URL, or the push URL when selected.',
    [remote, secondary('URL or path'), flag('Set push URL')],
  ),
  tool(
    'remoteRename',
    'Rename remote',
    'Remotes',
    'Rename a remote and its tracking references.',
    [remote, secondary('New remote name')],
  ),
  tool(
    'remoteRemove',
    'Remove remote',
    'Remotes',
    'Remove local remote configuration and tracking refs. The server repository is unchanged.',
    [remote],
    { danger: true },
  ),
  tool(
    'setUpstream',
    'Set branch upstream',
    'Branches',
    'Set tracking for an existing local branch.',
    [branch, secondary('Upstream branch', 'origin/main')],
  ),
  tool(
    'unsetUpstream',
    'Unset branch upstream',
    'Branches',
    'Remove tracking from a local branch.',
    [branch],
  ),
  tool(
    'fetchOptions',
    'Fetch with options',
    'Remotes',
    'Fetch one remote or leave Remote blank to fetch all configured remotes.',
    [
      optional(remote),
      flag('Prune stale tracking refs'),
      extra('Fetch all tags'),
    ],
  ),
  tool(
    'pullOptions',
    'Pull with options',
    'Remotes',
    'Fetch and integrate the specified remote branch. Requires clean working files.',
    [
      remote,
      secondary('Remote branch', 'main'),
      mode('Integration', ['ff', 'merge', 'rebase']),
    ],
  ),
  tool(
    'pushOptions',
    'Push with options',
    'Remotes',
    'Push the current HEAD to a destination branch. Lease checks the last fetched remote commit; force can overwrite others’ history.',
    [
      remote,
      secondary('Destination branch', 'main'),
      mode('Push mode', ['normal', 'lease', 'force']),
      flag('Set upstream'),
    ],
    { danger: true },
  ),
  tool(
    'deleteRemoteBranch',
    'Delete remote branch',
    'Remotes',
    'Delete a branch on the selected remote server.',
    [remote, secondary('Remote branch')],
    { danger: true },
  ),
  tool(
    'tags',
    'List tags',
    'Tags',
    'Show local tag names, object IDs and messages.',
    [],
    { read: true },
  ),
  tool(
    'tagCreate',
    'Create annotated or signed tag',
    'Tags',
    'Create a local tag. Signing uses your configured non-interactive Git signing setup.',
    [
      target('Tag name'),
      secondary('Revision', 'HEAD'),
      mode('Tag type', ['annotated', 'lightweight', 'signed']),
      { ...message('Tag message'), optional: true },
    ],
  ),
  tool(
    'tagDelete',
    'Delete local tag',
    'Tags',
    'Remove a local tag. Its target commit is not deleted.',
    [target('Tag name')],
    { danger: true },
  ),
  tool(
    'tagPush',
    'Push tag',
    'Tags',
    'Publish one local tag to the selected remote.',
    [remote, secondary('Tag name')],
  ),
  tool(
    'tagDeleteRemote',
    'Delete remote tag',
    'Tags',
    'Remove the tag from the remote server.',
    [remote, secondary('Tag name')],
    { danger: true },
  ),
  tool(
    'checkoutRevision',
    'Check out detached revision',
    'Branches',
    'Inspect an exact commit in detached HEAD state. Requires clean files.',
    [revision],
  ),
  tool(
    'reset',
    'Reset current branch',
    'History editing',
    'Soft keeps index and files; mixed unstages; hard discards tracked changes and can remove obstructing untracked files.',
    [revision, mode('Reset mode', ['soft', 'mixed', 'hard'])],
    { danger: true },
  ),
  tool(
    'discard',
    'Discard file changes',
    'Working files',
    'Restore the working file from the index. Unstaged edits will be lost.',
    [file],
    { danger: true },
  ),
  tool(
    'cleanPreview',
    'Preview untracked cleanup',
    'Working files',
    'List the files Git would remove. Nothing is deleted.',
    [optional(file), flag('Include ignored files')],
    { read: true },
  ),
  tool(
    'clean',
    'Clean untracked files',
    'Working files',
    'Permanently delete untracked files and directories. Preview first. Nested repositories are not force-deleted.',
    [optional(file), flag('Include ignored files')],
    { danger: true },
  ),
  tool(
    'amend',
    'Amend last commit',
    'History editing',
    'Replace the current commit using the staged index and message. Also available at an interactive-rebase edit stop.',
    [
      message('Replacement commit message'),
      flag('Reset author to current identity'),
    ],
    { danger: true },
  ),
  tool(
    'fixup',
    'Create fixup or squash commit',
    'History editing',
    'Commit staged changes for a later interactive rebase.',
    [revision, flag('Create squash instead of fixup')],
  ),
  tool(
    'mergeOptions',
    'Merge with options',
    'History editing',
    'Merge a revision with explicit fast-forward/squash behavior. Requires clean files. Squash leaves changes staged for a new commit.',
    [
      revision,
      mode('Merge mode', ['ff', 'no-ff', 'ff-only', 'squash']),
      flag('Stop before committing'),
    ],
  ),
  tool(
    'rebaseOptions',
    'Rebase with options',
    'History editing',
    'Replay commits after Upstream onto a new base. Leave New base blank to use Upstream.',
    [
      target('Upstream revision'),
      optional(secondary('New base (onto)')),
      flag('Preserve merge topology'),
    ],
    { danger: true },
  ),
  tool(
    'interactiveRebase',
    'Interactive rebase',
    'History editing',
    'Load a linear commit range, reorder commits, then pick, edit, squash, fixup or drop. Edit pauses so you can amend the commit before continuing.',
    [target('Upstream revision')],
    { danger: true, editor: 'rebase' },
  ),
  tool(
    'pickOptions',
    'Cherry-pick with options',
    'History editing',
    'Apply commit IDs in the order entered. A merge commit needs a mainline parent number.',
    [
      target('Commit IDs (space separated)'),
      optional(secondary('Mainline parent number')),
      flag('Apply without committing'),
      extra('Record original commit ID'),
    ],
  ),
  tool(
    'revertOptions',
    'Revert with options',
    'History editing',
    'Reverse commit IDs in the order entered. A merge commit needs a mainline parent number.',
    [
      target('Commit IDs (space separated)'),
      optional(secondary('Mainline parent number')),
      flag('Apply without committing'),
    ],
  ),
  tool(
    'stashOptions',
    'Stash with options',
    'Stashes',
    'Save selected paths or all changes. Keep-index preserves staged work in the working tree.',
    [
      optional(file),
      message('Stash message'),
      flag('Include untracked files'),
      extra('Keep index'),
    ],
  ),
  tool(
    'stashShow',
    'Inspect stash',
    'Stashes',
    'Show a saved stash patch, including untracked files, and its object ID.',
    [field('target', 'Stash reference', undefined, 'stash@{0}')],
    { read: true },
  ),
  tool(
    'stashBranch',
    'Create branch from stash',
    'Stashes',
    'Restore a stash on a branch based on its original commit. Copy its full object ID from Inspect stash to protect against stale selection.',
    [
      field('target', 'Stash reference', undefined, 'stash@{0}'),
      secondary('New branch name'),
      message('Expected stash object ID'),
    ],
  ),
  tool(
    'worktrees',
    'List worktrees',
    'Worktrees',
    'Show each working tree, branch and administrative state.',
    [],
    { read: true },
  ),
  tool(
    'worktreeAdd',
    'Add worktree',
    'Worktrees',
    'Create an independent working directory. Git refuses a branch already checked out elsewhere.',
    [
      target('Destination path'),
      secondary('Branch name'),
      flag('Create new branch'),
    ],
  ),
  tool(
    'worktreeRemove',
    'Remove worktree',
    'Worktrees',
    'Remove a clean linked worktree. Dirty worktrees are refused.',
    [target('Worktree path')],
    { danger: true },
  ),
  tool(
    'worktreePrune',
    'Prune stale worktrees',
    'Worktrees',
    'Remove expired administrative records for missing worktrees. Uses Git’s expiration policy.',
  ),
  tool(
    'submodules',
    'Submodule status',
    'Submodules',
    'Show nested submodule commits and initialization state.',
    [],
    { read: true },
  ),
  tool(
    'submoduleAdd',
    'Add submodule',
    'Submodules',
    'Add a submodule URL at a relative directory and stage its metadata.',
    [target('Submodule URL'), secondary('Relative directory')],
  ),
  tool(
    'submoduleUpdate',
    'Update submodules',
    'Submodules',
    'Initialize and recursively update submodules. Leave the path blank for all.',
    [optional(file), flag('Follow remote tracking branches')],
  ),
  tool(
    'submoduleSync',
    'Sync submodule URLs',
    'Submodules',
    'Synchronize configured URLs from .gitmodules, recursively.',
    [optional(file)],
  ),
  tool(
    'submoduleDeinit',
    'Deinitialize submodule',
    'Submodules',
    'Unregister and remove the submodule working directory. Git refuses local changes.',
    [file],
    { danger: true },
  ),
  tool(
    'sparseShow',
    'Show sparse checkout',
    'Working files',
    'List the selected sparse directories.',
    [],
    { read: true },
  ),
  tool(
    'sparseSet',
    'Configure sparse checkout',
    'Working files',
    'Use cone mode to keep the listed directories. Requires clean files.',
    [message('Directories (one per line)')],
  ),
  tool(
    'sparseDisable',
    'Disable sparse checkout',
    'Working files',
    'Restore the full working tree. Requires clean files.',
  ),
  tool(
    'bisectStatus',
    'Bisect status',
    'Bisect',
    'Read the current bisect log and tested revisions.',
    [],
    { read: true },
  ),
  tool(
    'bisectStart',
    'Start bisect',
    'Bisect',
    'Search between a known bad and good commit. Git checks out candidate commits; test the application, then mark each result.',
    [target('Bad revision'), secondary('Good revision')],
  ),
  ...(['Good', 'Bad', 'Skip', 'Reset'] as const).map((label) =>
    tool(
      `bisect${label}`,
      `${label === 'Reset' ? 'Finish' : label === 'Skip' ? 'Skip revision in' : 'Mark ' + label.toLowerCase() + ' in'} bisect`,
      'Bisect',
      label === 'Reset'
        ? 'End bisect and restore the original branch.'
        : 'Record the test result and move to the next candidate. Requires clean files.',
    ),
  ),
  tool(
    'notesShow',
    'Read commit note',
    'Notes',
    'Display a note without modifying the commit.',
    [revision],
    { read: true },
  ),
  tool(
    'notesSave',
    'Save commit note',
    'Notes',
    'Replace the note attached to a commit. The commit object stays unchanged.',
    [revision, message('Note')],
  ),
  tool(
    'notesRemove',
    'Remove commit note',
    'Notes',
    'Delete the note attached to a commit.',
    [revision],
    { danger: true },
  ),
  ...(['Read', 'Write'] as const).map((action) =>
    tool(
      `config${action}`,
      `${action === 'Read' ? 'Read' : 'Set'} Git configuration`,
      'Configuration',
      'Manage identity, signing and common Git behavior at local or global scope.',
      [
        field(
          'target',
          'Configuration key',
          [
            'user.name',
            'user.email',
            'user.signingkey',
            'commit.gpgsign',
            'core.autocrlf',
            'core.ignorecase',
            'pull.rebase',
            'fetch.prune',
            'push.default',
            'merge.conflictstyle',
            'rerere.enabled',
          ],
          'user.name',
        ),
        mode('Scope', ['local', 'global']),
        ...(action === 'Write' ? [message('Value')] : []),
      ],
      { read: action === 'Read' },
    ),
  ),
  tool(
    'editorRead',
    'Edit repository files',
    'Configuration',
    'Edit ignore rules, attributes and mailmap. Saving checks that the original file has not changed elsewhere.',
    [
      field(
        'target',
        'Repository file',
        ['.gitignore', '.gitattributes', '.mailmap'],
        '.gitignore',
      ),
    ],
    { editor: 'file' },
  ),
  tool(
    'conflictRead',
    'Resolve file conflict',
    'Working files',
    'Compare base, ours and theirs; edit the result, save, then stage. During a rebase, ours is the rebased side and theirs is the replayed commit.',
    [file],
    { editor: 'conflict' },
  ),
  tool(
    'conflictChoose',
    'Use one conflict side',
    'Working files',
    'Replace a conflicted working file with ours or theirs. Review it before staging; during rebase the side meanings are reversed.',
    [file, mode('Conflict side', ['ours', 'theirs'])],
    { danger: true },
  ),
  tool(
    'patchPreview',
    'Inspect patch',
    'Patches',
    'Display a patch summary without modifying the repository.',
    [message('Unified patch')],
    { read: true },
  ),
  tool(
    'patchApply',
    'Apply patch to index and files',
    'Patches',
    'Apply a unified patch to both index and working files. Git checks applicability and paths.',
    [message('Unified patch')],
  ),
  tool(
    'patchExport',
    'Export mail patches',
    'Patches',
    'Generate format-patch output for the commit range. Copy or save the resulting text.',
    [target('Base revision'), secondary('Head revision', 'HEAD')],
    { read: true },
  ),
  tool(
    'mailApply',
    'Apply mail patches',
    'Patches',
    'Apply format-patch messages with three-way recovery. Conflicts can be resolved and continued or aborted.',
    [message('Mail patches')],
  ),
  tool(
    'archive',
    'Archive revision',
    'Patches',
    'Write a ZIP archive of tracked files to a new destination filename.',
    [revision, secondary('Absolute ZIP path')],
  ),
  tool(
    'verify',
    'Verify repository',
    'Maintenance',
    'Run Git’s full object and reference integrity check.',
    [],
    { read: true },
  ),
  tool(
    'garbageCollect',
    'Optimize repository',
    'Maintenance',
    'Run Git garbage collection using its configured retention policy.',
  ),
  tool(
    'recoverObjects',
    'Find unreachable objects',
    'Maintenance',
    'List unreachable objects without deleting them. Recover commits by creating a branch at the reported ID.',
    [],
    { read: true },
  ),
  tool(
    'statistics',
    'Contributor statistics',
    'Inspect',
    'Show commit counts and contributor identities across refs.',
    [],
    { read: true },
  ),
  tool(
    'largeFiles',
    'Largest tracked files',
    'Inspect',
    'Show the 100 largest files in HEAD. Sizes describe Git blobs, not the entire object database.',
    [],
    { read: true },
  ),
  tool(
    'hunkDiff',
    'Stage selected lines',
    'Working files',
    'Load a tracked file’s diff, select added or removed lines, and stage or unstage just those changes.',
    [file, flag('Unstage from the index')],
    { editor: 'hunks' },
  ),
];
export function initialToolValues(
  tool: GitTool,
  context: ToolContext,
): ToolValues {
  const values: ToolValues = {
    target: '',
    secondary: '',
    message: '',
    mode: '',
    flag: false,
    extra: false,
  };
  for (const f of tool.fields) {
    const value = f.context ? context[f.context] : f.initial;
    if (value !== undefined) Object.assign(values, { [f.key]: value });
  }
  return values;
}
