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
  Archive,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { native, openRepository, readSaved, save } from './api';
import { demoRepo } from './demo';
import type { Repository, GitOperation } from './types';
import { applySettings, useSettings, updateSettings } from './settings';
import { settingsCommands } from './settings-commands';
import { CommandPalette } from './components/CommandPalette';
import type { PaletteCommand } from './lib/commands';
import type { PreferencesTab } from './components/Preferences';
import { Sidebar, navigation } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { Preferences } from './components/Preferences';
import { Modal } from './components/Modal';
import { gitTools } from './git-tools';
import { CreateRepositoryDialog } from './components/CreateRepositoryDialog';

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
  const settings = useSettings();
  const [preferencesTab, setPreferencesTab] =
    useState<PreferencesTab>('Appearance');
  const [preferencesSection, setPreferencesSection] = useState('');
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
    'new' | 'preferences' | 'commands' | 'shortcuts' | 'create' | null
  >(null);
  const [query, setQuery] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState({
    text: 'Ready',
    busy: false,
    branch: '',
    hasChanges: false,
    hasRemotes: false,
    operation: null as GitOperation | null,
  });
  const current = tabs.find((tab) => tab.id === active);
  useEffect(() => {
    applySettings(settings);
  }, [settings]);
  const onStatus = useCallback(
    (
      text: string,
      busy: boolean,
      branch: string,
      hasChanges: boolean,
      hasRemotes: boolean,
      operation: GitOperation | null,
    ) => setStatus({ text, busy, branch, hasChanges, hasRemotes, operation }),
    [],
  );
  function showPreferences(tab: PreferencesTab = 'Appearance', section = '') {
    setPreferencesTab(tab);
    setPreferencesSection(section);
    setModal('preferences');
  }
  function changeSetting(change: Parameters<typeof updateSettings>[0]) {
    updateSettings(change);
    setModal(null);
  }
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
  const unavailable = !current
    ? 'Open a repository first'
    : status.busy
      ? 'Wait for the current operation to finish'
      : status.operation
        ? `Finish or abort the active ${status.operation} first`
        : undefined;
  const commands: PaletteCommand[] = [
    {
      id: 'new-tab',
      group: 'Workspace',
      name: 'New tab',
      detail: 'Open a saved repository in an independent tab',
      icon: Plus,
      keys: `${platformKey} T`,
      run: showNew,
    },
    {
      id: 'clone-init',
      group: 'Workspace',
      name: 'Clone or initialize repository',
      detail: 'Create a new local repository or clone a remote',
      icon: FolderGit2,
      run: () => setModal('create'),
    },
    ...gitTools.map((tool) => ({
      id: `tool-${tool.id}`,
      group: tool.group,
      name: tool.name,
      detail: tool.description,
      icon: GitBranch,
      disabled: !current
        ? 'Open a repository first'
        : status.busy
          ? 'Wait for the current operation'
          : undefined,
      run: () => {
        setModal(null);
        dispatch(`tool:${tool.id}`);
      },
    })),
    {
      id: 'open-repository',
      group: 'Workspace',
      name: 'Open repository',
      detail: 'Add a local Git repository to your workspace',
      icon: FolderOpen,
      keys: `${platformKey} O`,
      run: () => {
        setModal(null);
        void browse();
      },
    },
    ...navigation.map(({ id, label, icon }, index) => ({
      id: `view-${id}`,
      group: 'Navigation',
      disabled: !current ? 'Open a repository first' : undefined,
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
      id: 'preferences',
      group: 'Settings',
      keywords:
        'settings configuration options theme color font zoom motion layout',
      name: 'Preferences',
      detail: 'Appearance, themes, text size, and integration status',
      icon: Settings2,
      keys: `${platformKey} ,`,
      run: () => showPreferences(),
    },
    {
      id: 'refresh',
      group: 'Repository',
      disabled: unavailable,
      name: 'Refresh repository',
      detail: 'Reload status and history from disk',
      icon: GitBranch,
      keys: `${platformKey} R`,
      run: () => {
        setModal(null);
        dispatch('refresh');
      },
    },
    {
      id: 'shortcuts',
      group: 'Help',
      name: 'Keyboard shortcuts',
      detail: 'Show all workspace shortcuts',
      keywords: 'help hotkeys',
      icon: Keyboard,
      keys: '?',
      run: () => setModal('shortcuts'),
    },
    {
      id: 'close-tab',
      group: 'Workspace',
      name: 'Close current tab',
      detail: current?.repo.name ?? 'No repository tab open',
      icon: X,
      keys: `${platformKey} W`,
      disabled: unavailable,
      run: () => {
        if (current) closeTab(current.id);
        setModal(null);
      },
    },
    ...tabs.map((tab, index) => ({
      id: `tab-${tab.id}`,
      group: 'Open tabs',
      name: `Switch to ${tab.repo.name}`,
      detail: `Tab ${index + 1} · ${tab.repo.path}`,
      selected: tab.id === active,
      icon: FolderGit2,
      run: () => {
        setActive(tab.id);
        setModal(null);
      },
    })),
    ...recent.map((repo, index) => ({
      id: `recent-${index}`,
      group: 'Recent repositories',
      name: `Open ${repo.name}`,
      detail: repo.path,
      icon: FolderOpen,
      run: () => {
        showNew();
        void addRepository(repo.path);
      },
    })),
    ...settingsCommands(settings, changeSetting, showPreferences, () =>
      setModal(null),
    ),
    ...[
      ...(['merge', 'rebase', 'cherryPick', 'revert'] as const).map((id) => ({
        id,
        name: {
          merge: 'Merge into current branch',
          rebase: 'Rebase current branch',
          cherryPick: 'Cherry-pick commit',
          revert: 'Revert commit',
        }[id],
        detail: 'Choose a target revision and review before applying',
        icon: GitBranch,
        disabled: status.hasChanges
          ? 'Commit or stash working changes first'
          : undefined,
      })),
      {
        id: 'publish',
        name: 'Publish current branch',
        detail: 'Push a new branch and set its upstream',
        icon: ArrowUp,
        disabled: !status.hasRemotes ? 'No remotes configured' : undefined,
      },
      {
        id: 'branch',
        name: 'New branch',
        detail: 'Choose a name before creating a branch',
        icon: GitBranch,
      },
      {
        id: 'stash',
        name: 'Stash working changes',
        detail: 'Review and name a stash, including untracked files',
        icon: Archive,
        disabled: !status.hasChanges
          ? 'No working changes to stash'
          : undefined,
      },
      {
        id: 'fetch',
        name: 'Fetch remotes',
        detail: 'Choose a remote to fetch in the Remotes view',
        icon: ArrowDown,
        disabled: !status.hasRemotes ? 'No remotes configured' : undefined,
      },
      {
        id: 'pull',
        name: 'Pull current branch',
        detail: 'Review a fast-forward-only pull from upstream',
        icon: ArrowDown,
        disabled: !status.hasRemotes ? 'No remotes configured' : undefined,
      },
      {
        id: 'push',
        name: 'Push current branch',
        detail: 'Review publishing committed changes to upstream',
        icon: ArrowUp,
        disabled: !status.hasRemotes ? 'No remotes configured' : undefined,
      },
    ].map((action) => ({
      ...action,
      group: 'Repository',
      disabled: unavailable || action.disabled,
      run: () => {
        setModal(null);
        dispatch(action.id);
      },
    })),
  ];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Workspace action dialogs own keyboard input until they are closed.
      if (!modal && document.querySelector('dialog[open]')) return;
      if (event.isComposing) return;
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
            break;
          case 'o':
            void browse();
            break;
          case 't':
            showNew();
            break;
          case ',':
            showPreferences();
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
            }}
          >
            <Search size={16} />
            <span>Commands…</span>
            <kbd>{platformKey} K</kbd>
          </button>
          <button
            className="icon-button"
            aria-label="Preferences"
            onClick={() => showPreferences()}
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
                <button
                  className="text-button"
                  onClick={() => setModal('create')}
                >
                  Clone or initialize repository
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
          }}
        >
          <Command size={12} />
          Command palette<kbd>{platformKey} K</kbd>
        </button>
      </footer>
      {modal === 'create' && (
        <CreateRepositoryDialog
          onClose={() => setModal(null)}
          onOpen={(path) => void addRepository(path)}
        />
      )}
      {modal === 'preferences' && (
        <Preferences
          initialTab={preferencesTab}
          initialSection={preferencesSection}
          onClose={() => setModal(null)}
        />
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
              data-autofocus
              placeholder="Find a saved repository…"
              aria-label="Find a saved repository"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="saved-repositories">
            <button
              className="text-button"
              disabled={opening}
              onClick={() => setModal('create')}
            >
              Clone or initialize repository
            </button>
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
        <CommandPalette commands={commands} onClose={() => setModal(null)} />
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
