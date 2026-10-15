import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, GitBranch, Search } from 'lucide-react';
import type { Branch, Commit } from '../types';
import { layoutGraph } from '../lib/graph';
const colors = [
  'var(--accent)',
  '#ca9ee6',
  '#8caaee',
  '#e5c890',
  '#81c8be',
  '#e78284',
];
export function History({
  commits,
  branches,
  selected,
  onSelect,
  onMore,
  hasMore,
  reference,
  setReference,
  loading,
}: {
  commits: Commit[];
  branches: Branch[];
  selected: string;
  onSelect: (commit: Commit) => void;
  onMore: () => void;
  hasMore: boolean;
  reference: string;
  setReference: (value: string) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(400);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () =>
      commits.filter((c) =>
        `${c.subject} ${c.author} ${c.id} ${c.refs.join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [commits, search],
  );
  const graph = useMemo(() => layoutGraph(filtered), [filtered]);
  const graphWidth = Math.min(
    220,
    Math.max(78, ...graph.map((g) => g.width * 18 + 20)),
  );
  const rowHeight = 45;
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.contentRect.height),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    setScroll(0);
  }, [search, reference]);
  const start = Math.max(0, Math.floor(scroll / rowHeight) - 8);
  const end = Math.min(
    filtered.length,
    Math.ceil((scroll + height) / rowHeight) + 8,
  );
  function navigate(direction: number) {
    const index = Math.max(
      0,
      Math.min(
        filtered.length - 1,
        filtered.findIndex((c) => c.id === selected) + direction,
      ),
    );
    if (filtered[index]) {
      onSelect(filtered[index]);
      const top = index * rowHeight;
      if (ref.current && (top < scroll || top + rowHeight > scroll + height))
        ref.current.scrollTop = Math.max(0, top - height / 2);
    }
  }
  return (
    <section className="history" aria-label="Commit history">
      <div className="history-filters">
        <GitBranch size={16} className="accent" />
        <select
          aria-label="Filter branch"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="filter-divider" />
        <span className="muted">Topological order</span>
        <span className="spacer" />
        <label className="history-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search loaded commits…"
            aria-label="Search loaded commits"
          />
          <kbd>/</kbd>
        </label>
      </div>
      <div
        className="history-columns"
        style={{
          gridTemplateColumns: `${graphWidth}px minmax(180px, 1fr) 154px 80px 94px`,
        }}
      >
        <span>GRAPH</span>
        <span>COMMIT MESSAGE</span>
        <span>AUTHOR</span>
        <span>COMMIT</span>
        <span>DATE</span>
      </div>
      <div
        ref={ref}
        className="history-scroll"
        tabIndex={0}
        role="listbox"
        aria-label="Commits"
        aria-activedescendant={
          filtered.slice(start, end).some((c) => c.id === selected)
            ? `commit-${selected}`
            : undefined
        }
        onScroll={(event) => setScroll(event.currentTarget.scrollTop)}
        onKeyDown={(event) => {
          if (['ArrowDown', 'j', 'ArrowUp', 'k'].includes(event.key)) {
            event.preventDefault();
            navigate(event.key === 'ArrowDown' || event.key === 'j' ? 1 : -1);
          }
        }}
      >
        <div
          style={{ height: filtered.length * rowHeight, position: 'relative' }}
        >
          {filtered.slice(start, end).map((commit, index) => {
            const n = start + index,
              row = graph[n];
            return (
              <div
                role="option"
                aria-selected={selected === commit.id}
                id={`commit-${commit.id}`}
                className={`commit-row ${selected === commit.id ? 'selected' : ''}`}
                key={commit.id}
                onClick={() => onSelect(commit)}
                style={{
                  top: n * rowHeight,
                  height: rowHeight,
                  gridTemplateColumns: `${graphWidth}px minmax(180px, 1fr) 154px 80px 94px`,
                }}
              >
                <svg width={graphWidth} height={45} aria-hidden="true">
                  <path
                    d={`M ${20 + row.lane * 18} 0 V 22.5`}
                    stroke={colors[row.color]}
                    fill="none"
                    strokeWidth="2"
                  />
                  {row.segments.map((edge, j) => (
                    <path
                      key={j}
                      d={
                        edge.node
                          ? `M ${20 + edge.from * 18} 22.5 C ${20 + edge.from * 18} 35, ${20 + edge.to * 18} 35, ${20 + edge.to * 18} 45`
                          : `M ${20 + edge.from * 18} 0 C ${20 + edge.from * 18} 24, ${20 + edge.to * 18} 24, ${20 + edge.to * 18} 45`
                      }
                      stroke={colors[edge.color]}
                      strokeWidth="2"
                      fill="none"
                    />
                  ))}
                  <circle
                    cx={20 + row.lane * 18}
                    cy={22.5}
                    r={selected === commit.id ? 5 : 4}
                    fill={
                      selected === commit.id ? colors[row.color] : 'var(--bg)'
                    }
                    stroke={colors[row.color]}
                    strokeWidth="2"
                  />
                </svg>
                <div className="commit-subject">
                  {commit.refs.map((r) => (
                    <span
                      className={`ref-badge ${r.includes('origin/') ? 'remote' : r.startsWith('tag:') ? 'tag' : ''}`}
                      key={r}
                    >
                      <GitBranch size={11} />
                      {r.replace('HEAD -> ', '')}
                    </span>
                  ))}
                  <span className="truncate" title={commit.subject}>
                    {commit.subject}
                  </span>
                </div>
                <div className="author-cell">
                  <span className={`avatar avatar-${n % 3}`}>
                    {commit.author
                      .split(' ')
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className="truncate">{commit.author}</span>
                </div>
                <span className="mono muted">{commit.id.slice(0, 7)}</span>
                <span
                  className="muted"
                  title={new Date(commit.timestamp * 1000).toLocaleString()}
                >
                  {new Date(commit.timestamp * 1000).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric' },
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {!filtered.length && (
          <div className="subtle-empty">
            {loading
              ? 'Loading history…'
              : search
                ? 'No loaded commits match your search.'
                : 'No commits yet. Your first commit starts the story.'}
          </div>
        )}
      </div>
      <footer className="history-footer">
        <span className="status-dot hollow" />
        {commits.length} commits loaded{' '}
        {hasMore && (
          <button className="text-button" disabled={loading} onClick={onMore}>
            Load more <ArrowDown size={12} />
          </button>
        )}
        <span className="spacer" />
        <kbd>j</kbd>
        <kbd>k</kbd>
        <span>to navigate</span>
      </footer>
    </section>
  );
}
