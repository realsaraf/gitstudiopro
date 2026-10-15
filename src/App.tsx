import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Command,
  Folder,
  FolderGit2,
  FolderOpen,
  GitBranch,
  Keyboard,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { native, openRepository, readSaved, save } from './api';
import { demoRepo } from './demo';
import type { Repository } from './types';
import { applyTheme } from './themes';
import { Sidebar, navigation } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { Preferences } from './components/Preferences';
import { Modal } from './components/Modal';

interface Tab {
  id: string;
  repo: Repository;
}
const platformKey = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl';
const dispatch = (command: string) =>
  window.dispatchEvent(
    new CustomEvent('workspace-command', { detail: command }),
  );
export function App() {
  const [tabs, setTabs] = useState<Tab[]>(
    !native && new URLSearchParams(location.search).get('demo') === 'true'
      ? [{ id: 'demo', repo: demoRepo }]
      : [],
  );
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const [recent, setRecent] = useState<Repository[]>(() => {
    const data = readSaved<Repository[]>('repositories', []);
    return Array.isArray(data)
      ? data
          .filter(
            (r) =>
              r && typeof r.path === 'string' && typeof r.name === 'string',
          )
          .slice(0, 30)
      : [];
  });
  const [modal, setModal] = useState<
    'new' | 'preferences' | 'commands' | 'shortcuts' | null
  >(null);
  const [query, setQuery] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState({
    text: 'Ready',
    busy: false,
    branch: '',
  });
  const [commandIndex, setCommandIndex] = useState(0);
  const current = tabs.find((tab) => tab.id === active);
  useEffect(() => {
    applyTheme(readSaved('theme', 0));
    const size = readSaved('fontSize', 15);
    document.documentElement.style.fontSize = `${Math.max(12, Math.min(18, Number(size) || 15))}px`;
    document.documentElement.dataset.reduceMotion = String(
      readSaved('reduceMotion', false),
    );
  }, []);
  const onStatus = useCallback(
    (text: string, busy: boolean, branch: string) =>
      setStatus({ text, busy, branch }),
    [],
  );
  function showNew() {
    setQuery('');
    setPath('');
    setError('');
    setModal('new');
  }
  async function addRepository(repositoryPath: string) {
    setOpening(true);
    setError('');
    try {
      const repo = await openRepository(repositoryPath.trim());
      const id = crypto.randomUUID();
      setTabs((old) => [...old, { id, repo }]);
      setActive(id);
      if (repo.path !== demoRepo.path)
        setRecent((old) => {
          const next = [repo, ...old.filter((r) => r.path !== repo.path)].slice(
            0,
            30,
          );
          save('repositories', next);
          return next;
        });
      setModal(null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setOpening(false);
    }
  }
  async function browse() {
    if (!native) {
      showNew();
      return;
    }
    try {
      const path = await open({
        directory: true,
        multiple: false,
        title: 'Open a Git repository',
      });
      if (typeof path === 'string') {
        setModal('new');
        await addRepository(path);
      }
    } catch (e) {
      setError(String(e));
      setModal('new');
    }
  }
  function closeTab(id: string) {
    const index = tabs.findIndex((tab) => tab.id === id);
    const next = tabs.filter((tab) => tab.id !== id);
    setTabs(next);
    if (id === active)
      setActive(next[Math.min(index, next.length - 1)]?.id ?? '');
  }
  const commands = [
    {
      name: 'New tab',
      detail: 'Open a saved repository in an independent tab',
      icon: Plus,
      keys: `${platformKey} T`,
      run: showNew,
    },
    {
      name: 'Open repository',
      detail: 'Add a local Git repository to your workspace',
      icon: FolderOpen,
      keys: `${platformKey} O`,
      run: () => void browse(),
    },
    ...navigation.map(({ id, label, icon }, index) => ({
      name: `Go to ${label.toLowerCase()}`,
      detail:
        id === 'changes'
          ? 'Review, stage, and commit'
          : `Open ${label.toLowerCase()}`,
      icon,
      keys: index < 2 ? `${platformKey} ${index + 1}` : '',
      run: () => {
        if (current) {
          setModal(null);
          dispatch(id);
        } else showNew();
      },
    })),
    {
      name: 'Preferences',
      detail: 'Appearance, text size, and integration status',
      icon: Settings2,
      keys: `${platformKey} ,`,
      run: () => setModal('preferences'),
    },
    {
      name: 'Refresh repository',
      detail: 'Reload status and history from disk',
      icon: GitBranch,
      keys: `${platformKey} R`,
      run: () => {
        setModal(null);
        dispatch('refresh');
      },
    },
  ];
  const filtered = commands.filter((c) =>
    `${c.name} ${c.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (
        modifier &&
        ['k', 'o', 't', ',', '1', '2', 'r', 'w'].includes(
          event.key.toLowerCase(),
        )
      ) {
        event.preventDefault();
        if (modal && event.key.toLowerCase() !== 'k') return;
        switch (event.key.toLowerCase()) {
          case 'k':
            setModal((old) => (old === 'commands' ? null : 'commands'));
            setQuery('');
            setCommandIndex(0);
            break;
          case 'o':
            void browse();
            break;
          case 't':
            showNew();
            break;
          case ',':
            setModal('preferences');
            break;
          case '1':
            dispatch('history');
            break;
          case '2':
            dispatch('changes');
            break;
          case 'r':
            dispatch('refresh');
            break;
          case 'w':
            if (current) closeTab(current.id);
            break;
        }
      } else if (
        !modal &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (event.target as HTMLElement).tagName,
        )
      ) {
        if (event.key === '?') setModal('shortcuts');
        if (event.key === '/') {
          event.preventDefault();
          document
            .querySelector<HTMLInputElement>(
              '.tab-workspace:not([hidden]) input[aria-label="Search loaded commits"]',
            )
            ?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img src="/mark.svg" alt="" />
          <span>
            gitstudio<span className="brand-pro">pro</span>
            <b>.</b>
          </span>
        </div>
        <div
          className="repository-tabs"
          role="tablist"
          aria-label="Repositories"
        >
          {tabs.map((tab) => (
            <div
              className={`repository-tab ${active === tab.id ? 'active' : ''}`}
              key={tab.id}
              role="presentation"
            >
              <button
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`panel-${tab.id}`}
                aria-selected={active === tab.id}
                tabIndex={active === tab.id ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key === 'Delete') {
                    event.preventDefault();
                    closeTab(tab.id);
                  }
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const index = tabs.findIndex((item) => item.id === tab.id);
                    const next =
                      tabs[
                        (index +
                          (event.key === 'ArrowRight' ? 1 : -1) +
                          tabs.length) %
                          tabs.length
                      ];
                    setActive(next.id);
                    document.getElementById(`tab-${next.id}`)?.focus();
                  }
                }}
                onClick={() => setActive(tab.id)}
              >
                <FolderGit2 size={17} />
                <span>{tab.repo.name}</span>
                <span
                  className="tab-close"
                  aria-hidden="true"
                  title="Close tab (Delete)"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X size={14} />
                </span>
              </button>
            </div>
          ))}
        </div>
        <button
          className="new-tab-button icon-button"
          aria-label="New tab"
          onClick={showNew}
        >
          <Plus size={21} />
        </button>
        <div className="header-actions">
          <button
            className="command-trigger"
            onClick={() => {
              setModal('commands');
              setQuery('');
              setCommandIndex(0);
            }}
          >
            <Search size={16} />
            <span>Commands…</span>
            <kbd>{platformKey} K</kbd>
          </button>
          <button
            className="icon-button"
            aria-label="Preferences"
            onClick={() => setModal('preferences')}
          >
            <Settings2 size={20} />
          </button>
        </div>
      </header>
      <div className="app-body">
        {tabs.map((tab) => (
          <div
            className="tab-workspace"
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            key={tab.id}
            hidden={active !== tab.id}
          >
            <Workspace
              repo={tab.repo}
              active={active === tab.id}
              onRepositories={showNew}
              onShortcuts={() => setModal('shortcuts')}
              onStatus={onStatus}
            />
          </div>
        ))}
        {!current && (
          <div className="empty-workspace">
            <Sidebar
              view="history"
              setView={showNew}
              onRepositories={showNew}
              onShortcuts={() => setModal('shortcuts')}
            />
            <main className="welcome-main">
              <div className="breadcrumb">
                <Folder size={14} />
                Repositories
                <ChevronRight size={13} />
                <span>No repository</span>
              </div>
              <header className="page-heading">
                <div>
                  <h1>Commit history</h1>
                  <p>A clear view of everything you’re building.</p>
                </div>
              </header>
              <div className="welcome">
                <div className="welcome-art">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <img src="/mark.svg" alt="" />
                  <span className="orbit-node one" />
                  <span className="orbit-node two" />
                  <span className="orbit-node three" />
                </div>
                <span className="eyebrow accent">
                  A LITTLE CLARITY FOR YOUR CODE
                </span>
                <h2>Great work starts here.</h2>
                <p>
                  Open a repository. Follow the history.
                  <br />
                  Make your next change with confidence.
                </p>
                <button
                  className="primary welcome-open"
                  onClick={() => void browse()}
                >
                  <FolderOpen size={19} />
                  Open repository<kbd>{platformKey} O</kbd>
                </button>
                <button className="text-button" onClick={showNew}>
                  Enter a repository path <ArrowRight size={15} />
                </button>
                {!native && (
                  <button
                    className="preview-link text-button"
                    onClick={() => void addRepository(demoRepo.path)}
                  >
                    Explore the read-only preview <ArrowRight size={14} />
                  </button>
                )}
                <div className="welcome-foot">
                  <ShieldCheck size={14} />
                  Local first<span>·</span>No account required<span>·</span>Open
                  source
                </div>
              </div>
            </main>
          </div>
        )}
      </div>
      <footer className="statusbar">
        <GitBranch size={13} />
        <span className="accent">
          {current ? status.branch || current.repo.branch : 'No repository'}
        </span>
        <span className="status-separator">|</span>
        <span className={`status-dot ${status.busy ? 'working' : ''}`} />
        <span role="status">{current ? status.text : 'Ready'}</span>
        <span className="spacer" />
        {!native && current && (
          <span className="preview-badge">READ-ONLY PREVIEW</span>
        )}
        <span className="status-tech">
          <Code2 size={13} />
          Rust core · native Git
        </span>
        <span className="status-separator">|</span>
        <button
          className="text-button"
          onClick={() => {
            setModal('commands');
            setQuery('');
            setCommandIndex(0);
          }}
        >
          <Command size={12} />
          Command palette<kbd>{platformKey} K</kbd>
        </button>
      </footer>
      {modal === 'preferences' && (
        <Preferences onClose={() => setModal(null)} />
      )}
      {modal === 'new' && (
        <Modal
          title="New tab"
          subtitle="Your repositories, one focused workspace."
          onClose={() => {
            if (!opening) setModal(null);
          }}
        >
          <label className="search-field">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Find a saved repository…"
              aria-label="Find a saved repository"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="saved-repositories">
            {recent
              .filter((r) =>
                `${r.name} ${r.path}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((repo) => (
                <div className="saved-repository" key={repo.path}>
                  <button
                    disabled={opening}
                    onClick={() => void addRepository(repo.path)}
                  >
                    <FolderGit2 size={23} />
                    <span>
                      <strong>{repo.name}</strong>
                      <small>{repo.path}</small>
                    </span>
                    {current?.repo.path === repo.path ? (
                      <Check size={17} className="accent" />
                    ) : (
                      <Plus size={17} />
                    )}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${repo.name} from recent repositories`}
                    onClick={() =>
                      setRecent((old) => {
                        const next = old.filter((r) => r.path !== repo.path);
                        save('repositories', next);
                        return next;
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            {!recent.length && (
              <div className="recent-empty">
                <FolderGit2 size={28} />
                <p>No repositories added yet.</p>
                <small>Open a local folder to get started.</small>
              </div>
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void addRepository(path);
            }}
          >
            <label className="form-label">
              Repository path
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder={
                  native
                    ? 'Full path to a local Git repository'
                    : 'Local repositories require the desktop app'
                }
                required
              />
            </label>
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <p className="modal-hint">
              Tabs keep independent views and selections. Tabs for the same
              repository share its checked-out branch and working files.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                disabled={opening}
                onClick={() => {
                  if (native) void browse();
                  else void addRepository(demoRepo.path);
                }}
              >
                {native ? <FolderOpen size={17} /> : <Code2 size={17} />}{' '}
                {native ? 'Browse folders' : 'Open preview'}
              </button>
              <button className="primary" disabled={opening || !path.trim()}>
                {opening ? 'Opening…' : 'Open repository'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'commands' && (
        <Modal title="Command palette" onClose={() => setModal(null)}>
          <div className="palette-search">
            <Search size={23} />
            <input
              autoFocus
              aria-label="Search commands"
              placeholder="Search commands…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCommandIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setCommandIndex(
                    (old) =>
                      (old +
                        (event.key === 'ArrowDown' ? 1 : -1) +
                        filtered.length) %
                      Math.max(1, filtered.length),
                  );
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  filtered[commandIndex]?.run();
                }
              }}
            />
            <kbd>esc</kbd>
          </div>
          <div className="section-label">COMMANDS</div>
          <div className="command-list">
            {filtered.map((command, i) => (
              <button
                key={command.name}
                className={`command-item ${i === commandIndex ? 'active' : ''}`}
                onMouseEnter={() => setCommandIndex(i)}
                onClick={command.run}
              >
                <span className="command-icon">
                  <command.icon size={23} />
                </span>
                <span>
                  <strong>{command.name}</strong>
                  <small>{command.detail}</small>
                </span>
                {command.keys && <kbd>{command.keys}</kbd>}
              </button>
            ))}
            {!filtered.length && (
              <p className="subtle-empty">No matching commands.</p>
            )}
          </div>
          <div className="palette-footer">
            <kbd>↑</kbd>
            <kbd>↓</kbd> to navigate <kbd>↵</kbd> to open
            <span className="spacer" />
            Esc to close
          </div>
        </Modal>
      )}
      {modal === 'shortcuts' && (
        <Modal
          title="Keyboard shortcuts"
          subtitle="Stay in your flow."
          onClose={() => setModal(null)}
        >
          <div className="shortcuts">
            {[
              ['Command palette', `${platformKey} K`],
              ['Open repository', `${platformKey} O`],
              ['New tab', `${platformKey} T`],
              ['Close current tab', `${platformKey} W`],
              ['Commit history', `${platformKey} 1`],
              ['Working changes', `${platformKey} 2`],
              ['Preferences', `${platformKey} ,`],
              ['Refresh', `${platformKey} R`],
              ['Search loaded commits', '/'],
              ['Navigate focused history', 'j / k or ↑ / ↓'],
              ['Close dialog', 'Esc'],
            ].map(([label, key]) => (
              <div key={label}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="privacy-note">
            <Keyboard size={18} />
            Panel dividers support arrow keys and double-click to reset.
          </p>
        </Modal>
      )}
    </div>
  );
}
