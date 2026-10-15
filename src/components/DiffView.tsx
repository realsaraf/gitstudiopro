import { useMemo, useState } from 'react';
import { Columns2, FileCode2, AlignLeft, Copy, Check } from 'lucide-react';
import { parseDiff, splitDiff } from '../lib/diff';
export function DiffView({
  patch,
  file,
  loading,
}: {
  patch: string;
  file: string;
  loading: boolean;
}) {
  const [split, setSplit] = useState(true);
  const [copied, setCopied] = useState(false);
  const parsed = useMemo(() => parseDiff(patch), [patch]);
  const lines = parsed
    .filter(
      (line) =>
        line.type !== 'meta' ||
        !/^(diff --git |index |--- |\+\+\+ )/.test(line.text),
    )
    .slice(0, 3000);
  const rows = useMemo(() => splitDiff(lines), [lines]);
  const added = parsed.filter((l) => l.type === 'add').length;
  const removed = parsed.filter((l) => l.type === 'remove').length;
  return (
    <section className="diff-view" aria-label="File diff">
      <header className="diff-toolbar">
        <FileCode2 size={15} />
        <span className="mono truncate">
          {file || 'Select a file to inspect'}
        </span>
        {file && (
          <>
            <span className="add-text">+{added}</span>
            <span className="remove-text">−{removed}</span>
          </>
        )}
        <span className="spacer" />
        <div className="segmented">
          <button
            aria-label="Unified diff"
            aria-pressed={!split}
            className={!split ? 'active' : ''}
            onClick={() => setSplit(false)}
          >
            <AlignLeft size={15} />
          </button>
          <button
            aria-label="Side by side diff"
            aria-pressed={split}
            className={split ? 'active' : ''}
            onClick={() => setSplit(true)}
          >
            <Columns2 size={15} />
          </button>
        </div>
        <button
          className="icon-button"
          aria-label="Copy diff"
          disabled={!patch}
          onClick={() => {
            void navigator.clipboard
              .writeText(patch)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => setCopied(false));
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </header>
      {split && file && (
        <div className="diff-columns">
          <span>Before</span>
          <span>After</span>
        </div>
      )}
      <div
        className="diff-code"
        aria-busy={loading}
        tabIndex={0}
        aria-label="Diff code"
      >
        {loading ? (
          <div className="subtle-empty">Loading diff…</div>
        ) : !patch ? (
          <div className="subtle-empty">
            {file
              ? 'No text changes in this file.'
              : 'Choose a file to see what changed.'}
          </div>
        ) : split ? (
          <div className="split-code">
            {rows.map((row, i) =>
              row.full ? (
                <div className={`diff-full ${row.full.type}`} key={i}>
                  {row.full.text}
                </div>
              ) : (
                <div className="split-row" key={i}>
                  {(['left', 'right'] as const).map((side) => (
                    <div
                      key={side}
                      className={`code-cell ${row[side]?.type ?? 'blank'}`}
                    >
                      <span className="line-number">
                        {side === 'left' ? row[side]?.old : row[side]?.next}
                      </span>
                      <span className="line-sign">
                        {row[side]?.type === 'add'
                          ? '+'
                          : row[side]?.type === 'remove'
                            ? '−'
                            : ''}
                      </span>
                      <code>{row[side]?.text ?? ' '}</code>
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="unified-code">
            {lines.map((line, i) => (
              <div key={i} className={`code-cell ${line.type}`}>
                <span className="line-number">{line.old}</span>
                <span className="line-number">{line.next}</span>
                <span className="line-sign">
                  {line.type === 'add'
                    ? '+'
                    : line.type === 'remove'
                      ? '−'
                      : ''}
                </span>
                <code>{line.text}</code>
              </div>
            ))}
          </div>
        )}
        {parsed.length > 3000 && (
          <p className="limit-note">
            Showing the first 3,000 lines. Copy the diff to inspect the complete
            output.
          </p>
        )}
      </div>
      <footer className="diff-footer">
        <span>Plain text · UTF-8</span>
        <span>
          {parsed.length} lines · {split ? 'Side by side' : 'Unified'}
        </span>
      </footer>
    </section>
  );
}
