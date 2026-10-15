import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  FileCode2,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  Globe2,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { readSaved, request, save } from '../api';
import type {
  Commit,
  FileChange,
  Repository,
  Request,
  Snapshot,
  View,
  GitOperation,
} from '../types';
import { Sidebar, navigation } from './Sidebar';
import { Divider } from './Divider';
import { DiffView } from './DiffView';
import { History } from './History';
import { Modal } from './Modal';
import { ActionMenu } from './ActionMenu';

const empty: Snapshot = {
  operation: null,
  branch: '',
  files: [],
  branches: [],
  remotes: [],
  stashes: [],
};
type Action = {
  title: string;
  description: string;
  kind?:
    'createBranch' | 'checkout' | 'stashSave' | 'stashApply' | 'pull' | 'push';
  name?: string;
  index?: number;
  input?: boolean;
  inputLabel?: string;
  expected?: string;
  command?: Request;
  build?: (value: string) => Request;
};
export function Workspace({
  repo,
  active,
  onRepositories,
  onShortcuts,
  onStatus,
}: {
  repo: Repository;
  active: boolean;
  onRepositories: () => void;
  onShortcuts: () => void;
  onStatus: (
    text: string,
    busy: boolean,
    branch: string,
    hasChanges: boolean,
    hasRemotes: boolean,
    operation: GitOperation | null,
  ) => void;
}) {
  const [view, setView] = useState<View>('history');
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selected, setSelected] = useState<Commit>();
  const [files, setFiles] = useState<FileChange[]>([]);
  const [file, setFile] = useState('');
  const [staged, setStaged] = useState(false);
  const [patch, setPatch] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Ready');
  const [reference, setReference] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(
    readSaved('sidebarWidth', 258),
  );
  const [historyHeight, setHistoryHeight] = useState(
    readSaved('historyHeight', 48),
  );
  const [action, setAction] = useState<Action>();
  const [commitMenuPosition, setCommitMenuPosition] = useState<{
    left: number;
    top: number;
  }>();
  const [actionValue, setActionValue] = useState('');
  const [message, setMessage] = useState('');
  const [compareBase, setCompareBase] = useState('main');
  const [compareHead, setCompareHead] = useState('HEAD');
  const [comparison, setComparison] = useState('');
  const [refresh, setRefresh] = useState(0);
  const historyGeneration = useRef(0);
  const pending = useRef(false);
  const historyBlocked =
    busy || !!snapshot.operation || !!snapshot.files.length;
  function confirm(
    title: string,
    description: string,
    command: Request | ((value: string) => Request),
    inputLabel?: string,
    initial = '',
  ) {
    setError('');
    setActionValue(initial);
    setAction({
      title,
      description,
      command: typeof command === 'function' ? undefined : command,
      build: typeof command === 'function' ? command : undefined,
      input: !!inputLabel,
      inputLabel,
    });
  }
  function historyAction(
    kind: 'merge' | 'rebase' | 'cherryPick' | 'revert',
    target: string,
  ) {
    const titles = {
      merge: 'Merge into current branch',
      rebase: 'Rebase current branch',
      cherryPick: 'Cherry-pick commit',
      revert: 'Revert commit',
    };
    confirm(
      titles[kind],
      `${titles[kind]} ${snapshot.branch || repo.branch} using ${target}. ${kind === 'rebase' ? 'This rewrites local commits; avoid rebasing shared history.' : 'Your index and working tree must be clean.'} If conflicts occur, resolve and stage them, then use Continue or Abort.`,
      { kind, revision: target },
    );
  }
  function commitMenu(commit: Commit) {
    return [
      {
        label: 'Cherry-pick commit',
        disabled: historyBlocked || commit.parents.length > 1,
        run: () => historyAction('cherryPick', commit.id),
      },
      {
        label: 'Revert commit',
        disabled: historyBlocked || commit.parents.length > 1,
        run: () => historyAction('revert', commit.id),
      },
      {
        label: 'Create branch at commit',
        disabled: busy || !!snapshot.operation,
        run: () =>
          confirm(
            'Create branch at commit',
            `Create a local branch at ${commit.id.slice(0, 12)}.`,
            (name) => ({ kind: 'createBranchAt', name, revision: commit.id }),
            'Branch name',
          ),
      },
      {
        label: 'Create tag',
        disabled: busy || !!snapshot.operation,
        run: () =>
          confirm(
            'Create tag',
            `Create a local lightweight tag at ${commit.id.slice(0, 12)}. Tags are not pushed automatically.`,
            (name) => ({ kind: 'createTag', name, revision: commit.id }),
            'Tag name',
          ),
      },
      {
        label: 'Copy commit hash',
        run: () => {
          void navigator.clipboard
            .writeText(commit.id)
            .then(() => setNotice('Commit hash copied'))
            .catch(report);
        },
      },
    ];
  }
  const newBranch = () => {
    setActionValue('');
    setAction({
      kind: 'createBranch',
      title: 'New branch',
      description:
        'Create a branch at the current HEAD. Your checked-out branch stays the same.',
      input: true,
    });
  };
  const newStash = () => {
    setActionValue('Work in progress');
    setAction({
      kind: 'stashSave',
      title: 'Stash working changes',
      description:
        'Save tracked and untracked changes, then return to a clean working directory.',
      input: true,
    });
  };
  const syncBranch = (kind: 'pull' | 'push') => {
    setAction({
      kind,
      title: kind === 'pull' ? 'Pull current branch' : 'Push current branch',
      description:
        kind === 'pull'
          ? 'Fetch and fast-forward from the current branch’s configured upstream. Divergent histories are refused.'
          : 'Publish committed changes using your Git push configuration and credentials. This operation does not force push.',
    });
  };
  const report = useCallback((e: unknown) => {
    setError(String(e instanceof Error ? e.message : e));
    setNotice('Operation failed');
  }, []);
  useEffect(() => {
    if (active)
      onStatus(
        notice,
        busy,
        snapshot.branch || repo.branch,
        !!snapshot.files.length,
        !!snapshot.remotes.length,
        snapshot.operation,
      );
  }, [
    active,
    notice,
    busy,
    snapshot.branch,
    snapshot.files.length,
    snapshot.remotes.length,
    snapshot.operation,
    repo.branch,
    onStatus,
  ]);
  useEffect(() => {
    const reset = () => {
      setSidebarWidth(258);
      setHistoryHeight(48);
    };
    const changed = () => setRefresh((n) => n + 1);
    window.addEventListener('reset-layout', reset);
    window.addEventListener('repository-changed', changed);
    window.addEventListener('focus', changed);
    return () => {
      window.removeEventListener('reset-layout', reset);
      window.removeEventListener('repository-changed', changed);
      window.removeEventListener('focus', changed);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const commands = (e: Event) => {
      const command = (e as CustomEvent<string>).detail;
      if (busy || action) return;
      if (navigation.some((n) => n.id === command)) setView(command as View);
      else if (command === 'refresh') setRefresh((n) => n + 1);
      else if (command === 'branch') newBranch();
      else if (['merge', 'rebase', 'cherryPick', 'revert'].includes(command)) {
        const kind = command as 'merge' | 'rebase' | 'cherryPick' | 'revert';
        const titles = {
          merge: 'Merge into current branch',
          rebase: 'Rebase current branch',
          cherryPick: 'Cherry-pick commit',
          revert: 'Revert commit',
        };
        const descriptions = {
          merge:
            'Merge the target into the current branch, preserving existing history.',
          rebase:
            'Replay the current branch onto the target. This rewrites local commits.',
          cherryPick:
            'Apply one non-merge commit to the current branch as a new commit.',
          revert: 'Create a new commit that reverses one non-merge commit.',
        };
        confirm(
          titles[kind],
          `${descriptions[kind]} Commit or stash changes first.`,
          (revision) => ({ kind, revision }),
          'Target revision',
        );
      } else if (command === 'publish')
        confirm(
          'Publish current branch',
          `Publish ${snapshot.branch} and set upstream without force pushing.`,
          (remote) => ({ kind: 'publish', remote }),
          'Remote name',
          snapshot.remotes[0]?.name,
        );
      else if (command === 'stash' && snapshot.files.length) newStash();
      else if (command === 'fetch') setView('remotes');
      else if (
        (command === 'pull' || command === 'push') &&
        snapshot.remotes.length
      )
        syncBranch(command);
    };
    window.addEventListener('workspace-command', commands);
    return () => window.removeEventListener('workspace-command', commands);
  }, [active, busy, action, snapshot]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void request<Snapshot>(repo.path, { kind: 'snapshot' })
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((e) => {
        if (!cancelled) report(e);
      });
    return () => {
      cancelled = true;
    };
  }, [repo.path, active, refresh, report]);
  useEffect(() => {
    if (!active) return;
    const generation = ++historyGeneration.current;
    void request<Commit[]>(repo.path, {
      kind: 'history',
      skip: 0,
      reference: reference || null,
    })
      .then((data) => {
        if (generation !== historyGeneration.current) return;
        setCommits(data);
        setHasMore(data.length === 150);
        setSelected(
          (previous) => data.find((c) => c.id === previous?.id) ?? data[0],
        );
      })
      .catch((e) => {
        if (generation === historyGeneration.current) report(e);
      });
    return () => {
      historyGeneration.current++;
    };
  }, [repo.path, active, refresh, reference, report]);
  useEffect(() => {
    if (!selected || view !== 'history') return;
    let cancelled = false;
    setFiles([]);
    setFile('');
    setPatch('');
    void request<FileChange[]>(repo.path, {
      kind: 'commitFiles',
      revision: selected.id,
    })
      .then((data) => {
        if (!cancelled) {
          setFiles(data);
          setFile(data[0]?.path ?? '');
        }
      })
      .catch((e) => {
        if (!cancelled) report(e);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, repo.path, view, report]);
  useEffect(() => {
    if (view !== 'changes') return;
    setFiles(snapshot.files);
    if (!snapshot.files.some((f) => f.path === file)) {
      const first = snapshot.files[0];
      setFile(first?.path ?? '');
      setStaged(!!first && first.index !== ' ' && first.index !== '?');
    }
  }, [view, snapshot.files, file]);
  useEffect(() => {
    if (!file || !['history', 'changes'].includes(view)) {
      setPatch('');
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    setPatch('');
    void request<string>(repo.path, {
      kind: 'diff',
      file,
      staged,
      revision: view === 'history' ? (selected?.id ?? null) : null,
    })
      .then((data) => {
        if (!cancelled) setPatch(data);
      })
      .catch((e) => {
        if (!cancelled) report(e);
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo.path, file, staged, view, selected?.id, refresh, report]);
  async function perform(command: Request, success: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('Working…');
    try {
      await request(repo.path, command);
      setNotice(success);
      setAction(undefined);
      if (command.kind === 'commit') setMessage('');
    } catch (e) {
      report(e);
      // A failed merge/pick/rebase can still change repository state. Refresh it
      // and reveal recovery controls rather than leaving the pre-operation UI.
      const next = await request<Snapshot>(repo.path, {
        kind: 'snapshot',
      }).catch(() => undefined);
      if (next) {
        setSnapshot(next);
        if (
          next.operation ||
          next.files.some(
            (f) =>
              f.index === 'U' ||
              f.worktree === 'U' ||
              ['AA', 'DD'].includes(f.index + f.worktree),
          )
        ) {
          setAction(undefined);
          setView('changes');
        }
      }
    } finally {
      window.dispatchEvent(new Event('repository-changed'));
      pending.current = false;
      setBusy(false);
    }
  }
  async function loadMore() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const generation = historyGeneration.current;
    try {
      const data = await request<Commit[]>(repo.path, {
        kind: 'history',
        skip: commits.length,
        reference: reference || null,
      });
      if (generation === historyGeneration.current) {
        setCommits((old) => [
          ...old,
          ...data.filter((c) => !old.some((p) => p.id === c.id)),
        ]);
        setHasMore(data.length === 150);
      }
    } catch (e) {
      report(e);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const title = navigation.find((item) => item.id === view)?.label;
  const stagedFiles = snapshot.files.filter(
    (f) =>
      f.index !== ' ' &&
      f.index !== '?' &&
      f.index !== 'U' &&
      f.worktree !== 'U' &&
      !['AA', 'DD'].includes(f.index + f.worktree),
  );
  const conflicts = snapshot.files.filter(
    (f) =>
      f.index === 'U' ||
      f.worktree === 'U' ||
      ['AA', 'DD'].includes(f.index + f.worktree),
  );
  const unstagedFiles = snapshot.files.filter((f) => f.worktree !== ' ');
  function fileList(items: FileChange[], isStaged = false) {
    return items.map((item) => (
      <div
        className={`file-item ${file === item.path && (view === 'history' || staged === isStaged) ? 'selected' : ''}`}
        key={item.path}
      >
        <button
          className="file-select"
          title={item.path}
          onClick={() => {
            setFile(item.path);
            setStaged(isStaged);
          }}
        >
          <FileCode2 size={15} />
          <span className="truncate">
            <strong>{item.path.split('/').pop()}</strong>
            <small>
              {item.path.includes('/')
                ? item.path.slice(0, item.path.lastIndexOf('/'))
                : 'Repository root'}
            </small>
          </span>
          <span
            className={`file-status ${item.index === 'A' || item.worktree === '?' ? 'add-text' : ''}`}
          >
            {view === 'history'
              ? item.index
              : isStaged
                ? item.index
                : item.worktree === '?'
                  ? 'U'
                  : item.worktree}
          </span>
        </button>
        {view === 'changes' && (
          <button
            className="icon-button stage-button"
            disabled={busy}
            aria-label={`${isStaged ? 'Unstage' : 'Stage'} ${item.path}`}
            onClick={() => {
              void perform(
                { kind: isStaged ? 'unstage' : 'stage', file: item.path },
                isStaged ? 'File unstaged' : 'File staged',
              );
              setStaged(!isStaged);
            }}
          >
            {isStaged ? <Minus size={14} /> : <Plus size={14} />}
          </button>
        )}
      </div>
    ));
  }
  return (
    <div
      className="workspace-shell"
      style={{ gridTemplateColumns: `${sidebarWidth}px 4px minmax(0,1fr)` }}
    >
      <Sidebar
        repo={repo}
        snapshot={snapshot}
        view={view}
        setView={(next) => {
          setView(next);
          setFile('');
          setPatch('');
        }}
        onRepositories={onRepositories}
        onNewBranch={newBranch}
        onShortcuts={onShortcuts}
        onBranch={(name) => {
          setReference(name);
          setView('history');
        }}
      />
      <Divider
        direction="vertical"
        value={sidebarWidth}
        min={210}
        max={390}
        label="Sidebar width"
        reset={258}
        onChange={(value) => {
          setSidebarWidth(value);
          save('sidebarWidth', value);
        }}
      />
      <main className="main-workspace">
        <div className="breadcrumb">
          <Folder size={14} />
          <button className="text-button" onClick={onRepositories}>
            Repositories
          </button>
          <ChevronRight size={13} />
          <span>{repo.name}</span>
          <span className="spacer" />
          <span className="local-label">
            <span className="status-dot" /> LOCAL REPOSITORY
          </span>
        </div>
        <header className="page-heading">
          <div>
            <h1>{title}</h1>
            <p>
              {view === 'history'
                ? 'Every change has a story.'
                : view === 'changes'
                  ? 'Shape your next commit.'
                  : view === 'compare'
                    ? 'See how two revisions differ.'
                    : `Manage your repository’s ${title?.toLowerCase()}.`}
            </p>
          </div>
          <div className="toolbar">
            <button
              className="icon-button"
              aria-label="Refresh repository"
              disabled={busy}
              onClick={() => setRefresh((n) => n + 1)}
            >
              <RefreshCw size={16} className={busy ? 'spin' : ''} />
            </button>
            <button
              disabled={busy || !snapshot.remotes.length}
              onClick={() =>
                void perform(
                  { kind: 'fetch', remote: snapshot.remotes[0].name },
                  'Fetch complete',
                )
              }
            >
              <ArrowDown size={16} />
              Fetch
            </button>
            <button
              disabled={busy || !snapshot.files.length}
              onClick={newStash}
            >
              <Archive size={16} />
              Stash
            </button>
            <button
              className="primary"
              disabled={busy || !!snapshot.operation}
              onClick={newBranch}
            >
              <Plus size={16} />
              New branch
            </button>
            <ActionMenu
              label="Repository actions"
              disabled={busy}
              items={[
                {
                  label: 'Merge into current branch',
                  disabled: historyBlocked,
                  run: () =>
                    confirm(
                      'Merge into current branch',
                      `Merge a branch or commit into ${snapshot.branch}.`,
                      (revision) => ({ kind: 'merge', revision }),
                      'Target revision',
                    ),
                },
                {
                  label: 'Rebase current branch',
                  disabled: historyBlocked,
                  run: () =>
                    confirm(
                      'Rebase current branch',
                      `Replay ${snapshot.branch} on another branch or commit. This rewrites history; avoid rebasing shared branches.`,
                      (revision) => ({ kind: 'rebase', revision }),
                      'Target revision',
                    ),
                },
                {
                  label: 'Publish current branch',
                  disabled: !!snapshot.operation || !snapshot.remotes.length,
                  run: () =>
                    confirm(
                      'Publish current branch',
                      `Push ${snapshot.branch} and set its upstream on the chosen remote. Existing remote history will not be overwritten.`,
                      (remote) => ({ kind: 'publish', remote }),
                      'Remote name',
                      snapshot.remotes[0]?.name,
                    ),
                },
                {
                  label: 'Stage all changes',
                  disabled: !snapshot.files.length,
                  run: () =>
                    void perform({ kind: 'stageAll' }, 'All changes staged'),
                },
                {
                  label: 'Unstage all changes',
                  disabled: !stagedFiles.length,
                  run: () =>
                    void perform(
                      { kind: 'unstageAll' },
                      'All changes unstaged',
                    ),
                },
              ]}
            />
          </div>
        </header>
        {(snapshot.operation || conflicts.length > 0) && (
          <section
            className="operation-banner"
            aria-label="Repository operation"
          >
            <div>
              <strong>
                {snapshot.operation
                  ? `${snapshot.operation} in progress`
                  : 'Conflicts need resolution'}
              </strong>
              <p>
                {conflicts.length
                  ? `${conflicts.length} conflicted file(s). Resolve them in your editor, then stage the resolved files.`
                  : 'Changes are staged. Continue to finish, or abort to restore the pre-operation state.'}
              </p>
            </div>
            <button onClick={() => setView('changes')}>Review conflicts</button>
            {snapshot.operation && (
              <>
                <button
                  disabled={busy || conflicts.length > 0}
                  onClick={() =>
                    void perform(
                      {
                        kind: 'operation',
                        operation: snapshot.operation!,
                        action: 'continue',
                      },
                      'Operation continued',
                    )
                  }
                >
                  Continue {snapshot.operation}
                </button>
                {snapshot.operation !== 'merge' && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      confirm(
                        `Skip ${snapshot.operation} commit`,
                        'Drop the current patch from this operation and continue with the remaining commits.',
                        {
                          kind: 'operation',
                          operation: snapshot.operation!,
                          action: 'skip',
                        },
                      )
                    }
                  >
                    Skip commit
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    confirm(
                      `Abort ${snapshot.operation}`,
                      'Cancel the operation and restore its starting state. Conflict-resolution edits made during the operation will be discarded.',
                      {
                        kind: 'operation',
                        operation: snapshot.operation!,
                        action: 'abort',
                      },
                    )
                  }
                >
                  Abort {snapshot.operation}
                </button>
              </>
            )}
          </section>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="text-button" onClick={() => setError('')}>
              Dismiss
            </button>
          </div>
        )}
        <div className="workspace-body">
          {view === 'history' ? (
            <div
              className="history-layout"
              style={{
                gridTemplateRows: `${historyHeight}% 5px minmax(0,1fr)`,
              }}
            >
              <History
                onContextMenu={(commit, position) => {
                  setSelected(commit);
                  setCommitMenuPosition(position);
                }}
                commits={commits}
                branches={snapshot.branches}
                selected={selected?.id ?? ''}
                onSelect={setSelected}
                onMore={() => void loadMore()}
                hasMore={hasMore}
                reference={reference}
                setReference={setReference}
                loading={busy}
              />
              <Divider
                direction="horizontal"
                value={historyHeight}
                min={25}
                max={72}
                label="History height"
                reset={48}
                onChange={(value) => {
                  setHistoryHeight(value);
                  save('historyHeight', value);
                }}
              />
              <div className="details-layout">
                <aside className="commit-details">
                  <div className="details-title">
                    <GitCommitHorizontal size={14} />
                    <span>COMMIT DETAILS</span>
                    {selected && (
                      <ActionMenu
                        label="Commit actions"
                        openAt={commitMenuPosition}
                        onDismiss={() => setCommitMenuPosition(undefined)}
                        items={commitMenu(selected)}
                        disabled={busy}
                      />
                    )}
                    <button
                      className="icon-button"
                      aria-label="Copy commit hash"
                      disabled={!selected}
                      onClick={() => {
                        if (selected)
                          void navigator.clipboard
                            .writeText(selected.id)
                            .then(() => setNotice('Commit hash copied'))
                            .catch(report);
                      }}
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                  {selected && (
                    <>
                      <h3>{selected.subject}</h3>
                      <div className="commit-author">
                        <span className="avatar">
                          {selected.author
                            .split(' ')
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <div>
                          <strong>{selected.author}</strong>
                          <small>
                            {new Date(selected.timestamp * 1000).toLocaleString(
                              undefined,
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              },
                            )}
                          </small>
                        </div>
                      </div>
                      <div className="commit-id mono">
                        <span>{selected.id.slice(0, 7)}</span>
                        <span>
                          {selected.parents.length} parent
                          {selected.parents.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="file-list-heading">
                    CHANGED FILES <span className="count">{files.length}</span>
                  </div>
                  <div className="file-list">
                    {fileList(files)}
                    {selected && !files.length && (
                      <p className="muted small-note">No changed files.</p>
                    )}
                  </div>
                </aside>
                <DiffView patch={patch} file={file} loading={diffLoading} />
              </div>
            </div>
          ) : view === 'changes' ? (
            <div className="changes-layout">
              <aside className="changes-list">
                <div className="file-list-heading">
                  UNSTAGED <span className="count">{unstagedFiles.length}</span>
                  <button
                    className="text-button"
                    disabled={busy || !unstagedFiles.length}
                    onClick={() =>
                      void perform({ kind: 'stageAll' }, 'All changes staged')
                    }
                  >
                    Stage all
                  </button>
                </div>
                <div className="changes-files">
                  {fileList(unstagedFiles)}
                  {!unstagedFiles.length && (
                    <p className="small-note muted">
                      Working directory is clean.
                    </p>
                  )}
                </div>
                <div className="file-list-heading">
                  STAGED <span className="count">{stagedFiles.length}</span>
                  <button
                    className="text-button"
                    disabled={busy || !stagedFiles.length}
                    onClick={() =>
                      void perform(
                        { kind: 'unstageAll' },
                        'All changes unstaged',
                      )
                    }
                  >
                    Unstage all
                  </button>
                </div>
                <div className="changes-files">
                  {fileList(stagedFiles, true)}
                  {!stagedFiles.length && (
                    <p className="small-note muted">
                      Stage files to include in your commit.
                    </p>
                  )}
                </div>
                <form
                  className="commit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void perform({ kind: 'commit', message }, 'Commit created');
                  }}
                >
                  <label htmlFor={`commit-message-${repo.path}`}>
                    Commit message
                  </label>
                  <textarea
                    id={`commit-message-${repo.path}`}
                    placeholder="A short, meaningful summary…"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                  />
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !!snapshot.operation ||
                      !!conflicts.length ||
                      !message.trim() ||
                      !stagedFiles.length
                    }
                  >
                    <Check size={16} />
                    Commit {stagedFiles.length} file
                    {stagedFiles.length !== 1 ? 's' : ''}
                  </button>
                  <small>
                    Commits use your configured Git identity and hooks.
                  </small>
                </form>
              </aside>
              <DiffView patch={patch} file={file} loading={diffLoading} />
            </div>
          ) : view === 'branches' ? (
            <div className="collection">
              <div className="collection-header">
                <GitBranch size={18} />
                <h2>Local and remote branches</h2>
                <span className="count">{snapshot.branches.length}</span>
              </div>
              {snapshot.branches.map((b) => (
                <div
                  className="collection-row"
                  key={b.name}
                  data-branch={b.name}
                >
                  <GitBranch size={19} />
                  <div>
                    <strong>{b.name}</strong>
                    <small>
                      {b.remote
                        ? 'Remote branch'
                        : b.upstream || 'No upstream configured'}
                    </small>
                  </div>
                  <span className="spacer" />
                  {b.current ? (
                    <span className="badge">
                      <Check size={13} />
                      Current branch
                    </span>
                  ) : b.remote ? (
                    <button
                      disabled={historyBlocked || b.name.endsWith('/HEAD')}
                      onClick={() =>
                        confirm(
                          'Track remote branch',
                          `Create and switch to a local branch tracking ${b.name}.`,
                          (name) => ({
                            kind: 'trackBranch',
                            name,
                            reference: b.name,
                          }),
                          'Branch name',
                          b.name.slice(b.name.indexOf('/') + 1),
                        )
                      }
                    >
                      Track branch
                    </button>
                  ) : (
                    <button
                      disabled={busy || !!snapshot.operation}
                      onClick={() =>
                        setAction({
                          kind: 'checkout',
                          name: b.name,
                          title: 'Switch branch',
                          description: `Check out ${b.name}. Git will refuse if this would overwrite local changes.`,
                        })
                      }
                    >
                      Switch branch
                    </button>
                  )}
                  <ActionMenu
                    label={`Branch actions for ${b.name}`}
                    disabled={busy || !!snapshot.operation}
                    items={[
                      {
                        label: 'Merge into current branch',
                        disabled: historyBlocked || b.current,
                        run: () => historyAction('merge', b.name),
                      },
                      {
                        label: 'Rebase current branch onto this',
                        disabled: historyBlocked || b.current,
                        run: () => historyAction('rebase', b.name),
                      },
                      ...(!b.remote
                        ? [
                            {
                              label: 'Rename branch',
                              run: () =>
                                confirm(
                                  'Rename branch',
                                  `Rename ${b.name}. Existing branches will not be overwritten.`,
                                  (newName) => ({
                                    kind: 'renameBranch',
                                    name: b.name,
                                    newName,
                                  }),
                                  'New branch name',
                                  b.name,
                                ),
                            },
                            {
                              label: 'Delete merged branch',
                              disabled: b.current,
                              run: () =>
                                confirm(
                                  'Delete merged branch',
                                  `Delete local branch ${b.name}. Git refuses if it is checked out or not fully merged.`,
                                  { kind: 'deleteBranch', name: b.name },
                                ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              ))}
              {!snapshot.branches.length && (
                <div className="subtle-empty">
                  Make your first commit to create a branch.
                </div>
              )}
            </div>
          ) : view === 'stashes' ? (
            <div className="collection">
              <div className="collection-header">
                <Archive size={18} />
                <h2>Saved work</h2>
                <span className="count">{snapshot.stashes.length}</span>
              </div>
              {snapshot.stashes.map((stash) => (
                <div
                  className="collection-row"
                  key={stash.id}
                  data-stash={stash.id}
                >
                  <Archive size={20} />
                  <div>
                    <strong>{stash.message}</strong>
                    <small className="mono">
                      stash@{'{'}
                      {stash.index}
                      {'}'}
                    </small>
                  </div>
                  <span className="spacer" />
                  <button
                    disabled={historyBlocked}
                    onClick={() =>
                      setAction({
                        kind: 'stashApply',
                        index: stash.index,
                        expected: stash.id,
                        title: 'Apply stash',
                        description:
                          'Restore these changes into the working directory. The stash will be kept; conflicts may need resolving in your editor.',
                      })
                    }
                  >
                    Apply stash
                  </button>
                  <ActionMenu
                    label={`Stash actions for ${stash.message}`}
                    disabled={busy || !!snapshot.operation}
                    items={[
                      {
                        label: 'Pop stash',
                        disabled: historyBlocked,
                        run: () =>
                          confirm(
                            'Pop stash',
                            'Apply this stash and remove it only if application succeeds. Conflicting stashes are kept.',
                            {
                              kind: 'stashPop',
                              index: stash.index,
                              expected: stash.id,
                            },
                          ),
                      },
                      {
                        label: 'Drop stash',
                        run: () =>
                          confirm(
                            'Drop stash',
                            `Permanently remove this saved stash: ${stash.message}. This does not change working files.`,
                            {
                              kind: 'stashDrop',
                              index: stash.index,
                              expected: stash.id,
                            },
                          ),
                      },
                    ]}
                  />
                </div>
              ))}
              {!snapshot.stashes.length && (
                <div className="collection-empty">
                  <Archive size={38} />
                  <h2>A little breathing room</h2>
                  <p>Stash your work when you need to switch context.</p>
                </div>
              )}
            </div>
          ) : view === 'remotes' ? (
            <div className="collection">
              <div className="collection-header">
                <Globe2 size={18} />
                <h2>Connected remotes</h2>
              </div>
              {snapshot.remotes.map((remote) => (
                <div className="collection-row" key={remote.name}>
                  <Globe2 size={22} />
                  <div>
                    <strong>{remote.name}</strong>
                    <small>{remote.url}</small>
                  </div>
                  <span className="spacer" />
                  <button
                    disabled={busy}
                    onClick={() =>
                      void perform(
                        { kind: 'fetch', remote: remote.name },
                        'Fetch complete',
                      )
                    }
                  >
                    <ArrowDown size={15} />
                    Fetch
                  </button>
                </div>
              ))}
              {!snapshot.remotes.length && (
                <p className="small-note muted">
                  No remotes configured. Add one with git remote add in your
                  terminal.
                </p>
              )}
              <div className="remote-actions">
                <button
                  disabled={
                    busy || !!snapshot.operation || !snapshot.remotes.length
                  }
                  onClick={() =>
                    confirm(
                      'Publish current branch',
                      `Publish ${snapshot.branch} and configure its upstream.`,
                      (remote) => ({ kind: 'publish', remote }),
                      'Remote name',
                      snapshot.remotes[0]?.name,
                    )
                  }
                >
                  Publish branch
                </button>
                <button
                  disabled={busy || !snapshot.remotes.length}
                  onClick={() => syncBranch('pull')}
                >
                  <ArrowDown size={16} />
                  Pull · fast-forward only
                </button>
                <button
                  className="primary"
                  disabled={busy || !snapshot.remotes.length}
                  onClick={() => syncBranch('push')}
                >
                  <ArrowUp size={16} />
                  Push
                </button>
              </div>
              <p className="small-note muted">
                Authentication uses your existing Git credential helper or SSH
                configuration.
              </p>
            </div>
          ) : (
            <div className="collection">
              <div className="collection-header">
                <ArrowLeftRight size={18} />
                <h2>Compare revisions</h2>
                <span className="badge">Read only</span>
              </div>
              <form
                className="compare-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError('');
                  void request<string>(repo.path, {
                    kind: 'compare',
                    base: compareBase,
                    head: compareHead,
                  })
                    .then(setComparison)
                    .catch(report);
                }}
              >
                <label>
                  Base revision
                  <input
                    value={compareBase}
                    onChange={(e) => setCompareBase(e.target.value)}
                    placeholder="main"
                    required
                  />
                </label>
                <ArrowLeftRight size={18} />
                <label>
                  Head revision
                  <input
                    value={compareHead}
                    onChange={(e) => setCompareHead(e.target.value)}
                    placeholder="HEAD"
                    required
                  />
                </label>
                <button className="primary">Compare</button>
              </form>
              <p className="small-note muted">
                File statistics between two commit trees. Your index and working
                files stay untouched.
              </p>
              <pre className="comparison-result">
                {comparison ||
                  'Choose two revisions to see their change summary.'}
              </pre>
            </div>
          )}
        </div>
      </main>
      {action && (
        <Modal
          title={action.title}
          subtitle={action.description}
          onClose={() => {
            if (!busy) setAction(undefined);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              let command: Request;
              if (action.build) command = action.build(actionValue.trim());
              else if (action.command) command = action.command;
              else if (action.kind === 'createBranch')
                command = { kind: 'createBranch', name: actionValue };
              else if (action.kind === 'stashSave')
                command = { kind: 'stashSave', message: actionValue };
              else if (action.kind === 'checkout')
                command = { kind: 'checkout', name: action.name! };
              else if (action.kind === 'stashApply')
                command = {
                  kind: 'stashApply',
                  index: action.index!,
                  expected: action.expected!,
                };
              else if (action.kind === 'pull' || action.kind === 'push')
                command = { kind: action.kind };
              else return;
              void perform(command, `${action.title} complete`);
            }}
          >
            {action.input && (
              <label className="form-label">
                {action.inputLabel ||
                  (action.kind === 'createBranch'
                    ? 'Branch name'
                    : 'Stash message')}
                <input
                  data-autofocus
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  placeholder={
                    action.kind === 'createBranch'
                      ? 'feature/my-change'
                      : 'Work in progress'
                  }
                  required
                />
              </label>
            )}
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAction(undefined)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy || (action.input && !actionValue.trim())}
              >
                {busy ? 'Working…' : action.title}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
