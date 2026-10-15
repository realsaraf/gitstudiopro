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
  branch: string;
  files: FileChange[];
  branches: Branch[];
  remotes: { name: string; url: string }[];
  stashes: { index: number; message: string }[];
}
export type View =
  'history' | 'changes' | 'branches' | 'stashes' | 'remotes' | 'compare';
export type Request =
  | { kind: 'snapshot' }
  | { kind: 'history'; skip: number; reference: string | null }
  | { kind: 'commitFiles'; revision: string }
  | { kind: 'diff'; revision: string | null; file: string; staged: boolean }
  | { kind: 'compare'; base: string; head: string }
  | { kind: 'stage' | 'unstage'; file: string }
  | { kind: 'commit' | 'stashSave'; message: string }
  | { kind: 'createBranch' | 'checkout'; name: string }
  | { kind: 'stashApply'; index: number }
  | { kind: 'fetch'; remote: string }
  | { kind: 'pull' | 'push' };
