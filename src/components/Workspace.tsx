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
} from '../types';
import { Sidebar, navigation } from './Sidebar';
import { Divider } from './Divider';
import { DiffView } from './DiffView';
import { History } from './History';
import { Modal } from './Modal';

const empty: Snapshot = {
  branch: '',
  files: [],
  branches: [],
  remotes: [],
  stashes: [],
};
type Action = {
  title: string;
  description: string;
  kind:
    'createBranch' | 'checkout' | 'stashSave' | 'stashApply' | 'pull' | 'push';
  name?: string;
  index?: number;
  input?: boolean;
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
  onStatus: (text: string, busy: boolean, branch: string) => void;
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
  const [actionValue, setActionValue] = useState('');
  const [message, setMessage] = useState('');
  const [compareBase, setCompareBase] = useState('main');
  const [compareHead, setCompareHead] = useState('HEAD');
  const [comparison, setComparison] = useState('');
  const [refresh, setRefresh] = useState(0);
  const historyGeneration = useRef(0);
  const pending = useRef(false);
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
  const report = useCallback((e: unknown) => {
    setError(String(e instanceof Error ? e.message : e));
    setNotice('Operation failed');
  }, []);
  useEffect(() => {
    if (active) onStatus(notice, busy, snapshot.branch || repo.branch);
  }, [active, notice, busy, snapshot.branch, repo.branch, onStatus]);
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
      if (navigation.some((n) => n.id === command)) setView(command as View);
      else if (command === 'refresh') setRefresh((n) => n + 1);
      else if (command === 'branch') newBranch();
    };
    window.addEventListener('workspace-command', commands);
    return () => window.removeEventListener('workspace-command', commands);
  }, [active]);
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
      window.dispatchEvent(new Event('repository-changed'));
      setAction(undefined);
      if (command.kind === 'commit') setMessage('');
    } catch (e) {
      report(e);
    } finally {
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
    (f) => f.index !== ' ' && f.index !== '?',
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
              onClick={() => {
                setActionValue('Work in progress');
                setAction({
                  kind: 'stashSave',
                  title: 'Stash working changes',
                  description:
                    'Save tracked and untracked changes, then return to a clean working directory.',
                  input: true,
                });
              }}
            >
              <Archive size={16} />
              Stash
            </button>
            <button className="primary" disabled={busy} onClick={newBranch}>
              <Plus size={16} />
              New branch
            </button>
          </div>
        </header>
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
                    disabled={busy || !message.trim() || !stagedFiles.length}
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
                <h2>Local branches</h2>
                <span className="count">
                  {snapshot.branches.filter((b) => !b.remote).length}
                </span>
              </div>
              {snapshot.branches
                .filter((b) => !b.remote)
                .map((b) => (
                  <div className="collection-row" key={b.name}>
                    <GitBranch size={19} />
                    <div>
                      <strong>{b.name}</strong>
                      <small>{b.upstream || 'No upstream configured'}</small>
                    </div>
                    <span className="spacer" />
                    {b.current ? (
                      <span className="badge">
                        <Check size={13} />
                        Current branch
                      </span>
                    ) : (
                      <button
                        disabled={busy}
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
                <div className="collection-row" key={stash.index}>
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
                    disabled={busy}
                    onClick={() =>
                      setAction({
                        kind: 'stashApply',
                        index: stash.index,
                        title: 'Apply stash',
                        description:
                          'Restore these changes into the working directory. The stash will be kept; conflicts may need resolving in your editor.',
                      })
                    }
                  >
                    Apply stash
                  </button>
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
                  disabled={busy || !snapshot.remotes.length}
                  onClick={() =>
                    setAction({
                      kind: 'pull',
                      title: 'Pull current branch',
                      description:
                        'Fetch and fast-forward from the current branch’s configured upstream. Divergent histories are refused.',
                    })
                  }
                >
                  <ArrowDown size={16} />
                  Pull · fast-forward only
                </button>
                <button
                  className="primary"
                  disabled={busy || !snapshot.remotes.length}
                  onClick={() =>
                    setAction({
                      kind: 'push',
                      title: 'Push current branch',
                      description:
                        'Publish committed changes using your Git push configuration and credentials. This operation does not force push.',
                    })
                  }
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
              if (action.kind === 'createBranch')
                command = { kind: 'createBranch', name: actionValue };
              else if (action.kind === 'stashSave')
                command = { kind: 'stashSave', message: actionValue };
              else if (action.kind === 'checkout')
                command = { kind: 'checkout', name: action.name! };
              else if (action.kind === 'stashApply')
                command = { kind: 'stashApply', index: action.index! };
              else command = { kind: action.kind };
              void perform(command, `${action.title} complete`);
            }}
          >
            {action.input && (
              <label className="form-label">
                {action.kind === 'createBranch'
                  ? 'Branch name'
                  : 'Stash message'}
                <input
                  autoFocus
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
