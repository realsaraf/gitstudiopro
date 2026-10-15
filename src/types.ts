export interface Repository {
  path: string;
  name: string;
  branch: string;
}
export interface Commit {
  id: string;
  parents: string[];
  author: string;
  email: string;
  timestamp: number;
  refs: string[];
  subject: string;
}
export interface FileChange {
  path: string;
  index: string;
  worktree: string;
}
export interface Branch {
  name: string;
  current: boolean;
  remote: boolean;
  upstream: string;
}
export interface Snapshot {
  operation: GitOperation | null;
  branch: string;
  files: FileChange[];
  branches: Branch[];
  remotes: { name: string; url: string }[];
  stashes: { index: number; id: string; message: string }[];
}
export type GitOperation = 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'am';
export type View =
  | 'history'
  | 'changes'
  | 'branches'
  | 'stashes'
  | 'remotes'
  | 'compare'
  | 'pulls';
export type Request =
  | { kind: 'tool'; command: import('./git-tools').ToolRequest }
  | { kind: 'snapshot' }
  | { kind: 'history'; skip: number; reference: string | null }
  | { kind: 'commitFiles'; revision: string }
  | { kind: 'diff'; revision: string | null; file: string; staged: boolean }
  | { kind: 'compare'; base: string; head: string }
  | { kind: 'stage' | 'unstage'; file: string }
  | { kind: 'commit' | 'stashSave'; message: string }
  | { kind: 'createBranch' | 'checkout'; name: string }
  | {
      kind: 'stashApply' | 'stashPop' | 'stashDrop';
      index: number;
      expected: string;
    }
  | { kind: 'merge' | 'rebase' | 'cherryPick' | 'revert'; revision: string }
  | { kind: 'renameBranch'; name: string; newName: string }
  | { kind: 'deleteBranch'; name: string }
  | { kind: 'trackBranch'; name: string; reference: string }
  | { kind: 'createBranchAt' | 'createTag'; name: string; revision: string }
  | { kind: 'publish'; remote: string }
  | { kind: 'stageAll' | 'unstageAll' }
  | {
      kind: 'operation';
      operation: GitOperation;
      action: 'continue' | 'abort' | 'skip';
    }
  | { kind: 'fetch'; remote: string }
  | { kind: 'pull' | 'push' };
