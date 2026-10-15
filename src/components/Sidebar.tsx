import {
  Archive,
  ArrowLeftRight,
  ChevronDown,
  FolderGit2,
  GitBranch,
  Globe2,
  History,
  Keyboard,
  Layers2,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Repository, Snapshot, View } from '../types';
export const navigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'history', label: 'Commit history', icon: History },
  { id: 'changes', label: 'Working changes', icon: Layers2 },
  { id: 'branches', label: 'Branches', icon: GitBranch },
  { id: 'stashes', label: 'Stashes', icon: Archive },
  { id: 'remotes', label: 'Remotes', icon: Globe2 },
  { id: 'compare', label: 'Compare branches', icon: ArrowLeftRight },
];
export function Sidebar({
  repo,
  snapshot,
  view,
  setView,
  onRepositories,
  onNewBranch,
  onShortcuts,
  onBranch,
}: {
  repo?: Repository;
  snapshot?: Snapshot;
  view: View;
  setView: (view: View) => void;
  onRepositories: () => void;
  onNewBranch?: () => void;
  onShortcuts: () => void;
  onBranch?: (name: string) => void;
}) {
  const locals = snapshot?.branches.filter((b) => !b.remote) ?? [];
  return (
    <aside className="sidebar">
      <button className="repository-switcher" onClick={onRepositories}>
        <span className="repository-icon">
          <FolderGit2 size={22} />
        </span>
        <span className="truncate">
          <strong>{repo?.name ?? 'Repositories'}</strong>
          <small title={repo?.path}>
            {repo?.path.replace(/^\\\\\?\\/, '') ??
              'Select or add a repository'}
          </small>
        </span>
        <ChevronDown size={16} />
      </button>
      <div className="section-label">WORKSPACE</div>
      <nav aria-label="Workspace">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${view === id ? 'active' : ''}`}
            onClick={() => setView(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === 'changes' && !!snapshot?.files.length && (
              <span className="count">{snapshot.files.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-divider" />
      <div className="section-label branch-heading">
        <ChevronDown size={12} /> LOCAL BRANCHES <span>{locals.length}</span>
        <button
          className="icon-button"
          disabled={!repo}
          onClick={onNewBranch}
          aria-label="Create branch"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="branch-list">
        {locals.map((branch) => (
          <button
            key={branch.name}
            title={branch.name}
            className={`branch-link ${branch.current ? 'current' : ''}`}
            onClick={() => onBranch?.(branch.name)}
          >
            <GitBranch size={14} />
            <span className="truncate">{branch.name}</span>
            {branch.current && <span className="status-dot" />}
          </button>
        ))}
        {!locals.length && (
          <span className="sidebar-empty">No local branches</span>
        )}
      </div>
      <div className="section-label branch-heading">
        <ChevronDown size={12} /> REMOTES{' '}
        <span>{snapshot?.remotes.length ?? 0}</span>
      </div>
      {snapshot?.remotes.map((remote) => (
        <button
          key={remote.name}
          className="branch-link"
          onClick={() => setView('remotes')}
        >
          <Globe2 size={14} />
          {remote.name}
          <span className="count">
            {
              snapshot.branches.filter(
                (b) => b.remote && b.name.startsWith(remote.name + '/'),
              ).length
            }
          </span>
        </button>
      ))}
      <div className="sidebar-bottom">
        <button className="branch-link" onClick={onShortcuts}>
          <Keyboard size={16} />
          Keyboard shortcuts<kbd>?</kbd>
        </button>
        <div className="version">
          <span>GitStudio Pro</span>
          <span>
            0.1.0 <b>α</b>
          </span>
        </div>
      </div>
    </aside>
  );
}
