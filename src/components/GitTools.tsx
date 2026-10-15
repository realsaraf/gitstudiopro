import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Search } from 'lucide-react';
import { request, readSaved, save } from '../api';
import { gitTools, initialToolValues } from '../git-tools';
import type {
  ToolAction,
  ToolContext,
  ToolResult,
  ToolValues,
} from '../git-tools';
import { editablePatch, partialPatch } from '../lib/partial-patch';
import { Modal } from './Modal';

export function GitTools({
  path,
  initial,
  context,
  onClose,
}: {
  path: string;
  initial?: ToolAction;
  context: ToolContext;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ToolAction>(
    initial ?? 'commitDetails',
  );
  const [query, setQuery] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<
    { name: string; target: string; secondary: string }[]
  >(() => {
    const value = readSaved<unknown>('tool-presets', []);
    return Array.isArray(value)
      ? value
          .filter(
            (v) =>
              v &&
              typeof v.name === 'string' &&
              typeof v.target === 'string' &&
              typeof v.secondary === 'string',
          )
          .slice(0, 50)
      : [];
  });
  const tool = gitTools.find((t) => t.id === selected)!;
  const [values, setValues] = useState<ToolValues>(() =>
    initialToolValues(tool, context),
  );
  const [result, setResult] = useState<ToolResult>();
  const [loadedValues, setLoadedValues] = useState<ToolValues>();
  const [content, setContent] = useState('');
  const [plan, setPlan] = useState<
    { action: string; id: string; subject: string }[]
  >([]);
  const [lines, setLines] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setValues(initialToolValues(tool, context));
    setResult(undefined);
    setLoadedValues(undefined);
    setError('');
    setContent('');
    setPlan([]);
    setLines(new Set());
    setConfirmed(false);
  }, [selected, path]);
  const matches = useMemo(
    () =>
      gitTools.filter((t) =>
        `${t.name} ${t.group} ${t.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );
  const parsed = useMemo(() => editablePatch(result?.text ?? ''), [result]);
  const set = (key: keyof ToolValues, value: string | boolean) => {
    setValues((v) => ({ ...v, [key]: value }));
    setConfirmed(false);
  };
  const refresh = () => window.dispatchEvent(new Event('repository-changed'));
  async function execute(
    action: ToolAction,
    override: Partial<ToolValues> = {},
    write = false,
  ) {
    if (busy || (write && !confirmed)) return;
    setBusy(true);
    setError('');
    try {
      const response = await request<ToolResult>(path, {
        kind: 'tool',
        command: { ...values, ...override, action, confirmed: write },
      });
      if (!write) {
        setResult(response);
        setLoadedValues({ ...values });
        setContent(response.text);
        setLines(new Set());
        if (tool.editor === 'rebase')
          setPlan(
            response.text
              .trim()
              .split('\n')
              .filter(Boolean)
              .map((line) => {
                const [action, id, ...subject] = line.split(' ');
                return { action, id, subject: subject.join(' ') };
              }),
          );
      } else {
        setResult(response);
        setLoadedValues(undefined);
        setConfirmed(false);
        refresh();
      }
    } catch (e) {
      setError(String(e));
      if (write) refresh();
    } finally {
      setBusy(false);
    }
  }
  const needsLoad = !!tool.editor;
  const loaded =
    !!loadedValues && JSON.stringify(loadedValues) === JSON.stringify(values);
  const applyEditor = () => {
    if (!loaded || !result || !confirmed) return;
    if (tool.editor === 'rebase')
      void execute(
        'interactiveRebase',
        {
          message: plan
            .map((p) => `${p.action} ${p.id} ${p.subject}`)
            .join('\n'),
        },
        true,
      );
    else if (tool.editor === 'hunks') {
      const patch = partialPatch(result.text, lines, values.flag);
      if (patch)
        void execute(
          'hunkApply',
          { message: patch, secondary: result.text },
          true,
        );
    } else
      void execute(
        tool.editor === 'file' ? 'editorSave' : 'conflictSave',
        { message: content, secondary: result.text },
        true,
      );
  };
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([result.text], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download =
      selected === 'patchExport' ? 'changes.patch' : `${selected}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Modal
      title="Repository tools"
      subtitle="Inspect, configure and change your repository."
      wide
      className="git-tools-modal"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="git-tools-layout">
        <aside className="git-tools-nav" aria-label="Git tools">
          <label className="tool-search">
            <Search size={15} />
            <input
              data-autofocus
              aria-label="Find Git tool"
              placeholder="Find a tool…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {Array.from(new Set(matches.map((t) => t.group))).map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              {matches
                .filter((t) => t.group === group)
                .map((t) => (
                  <button
                    key={t.id}
                    disabled={busy}
                    aria-pressed={selected === t.id}
                    className={selected === t.id ? 'active' : ''}
                    onClick={() => setSelected(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
            </section>
          ))}
          {!matches.length && <p>No tools match.</p>}
        </aside>
        <section className="git-tool-detail" aria-label={tool.name}>
          <h3>{tool.name}</h3>
          <p className="muted">{tool.description}</p>
          {selected === 'runScript' && (
            <section className="setting-card">
              <label className="tool-field">
                Saved tool
                <select
                  aria-label="Saved tool"
                  disabled={busy}
                  value=""
                  onChange={(e) => {
                    const preset = presets.find(
                      (p) => p.name === e.target.value,
                    );
                    if (preset) {
                      setValues((v) => ({
                        ...v,
                        target: preset.target,
                        secondary: preset.secondary,
                      }));
                      setPresetName(preset.name);
                      setConfirmed(false);
                    }
                  }}
                >
                  <option value="">Choose a saved tool</option>
                  {presets.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="tool-field">
                Preset name
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
              </label>
              <div className="toolbar">
                <button
                  disabled={busy || !presetName.trim() || !values.target}
                  onClick={() => {
                    const next = [
                      ...presets.filter((p) => p.name !== presetName),
                      {
                        name: presetName,
                        target: values.target,
                        secondary: values.secondary,
                      },
                    ].slice(-50);
                    setPresets(next);
                    save('tool-presets', next);
                  }}
                >
                  Save tool preset
                </button>
                <button
                  disabled={busy || !presets.some((p) => p.name === presetName)}
                  onClick={() => {
                    const next = presets.filter((p) => p.name !== presetName);
                    setPresets(next);
                    save('tool-presets', next);
                  }}
                >
                  Remove preset
                </button>
              </div>
              <small>
                Saved arguments are local preferences. Do not include secrets.
              </small>
            </section>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void execute(
                tool.editor === 'rebase' ? 'rebasePlan' : tool.id,
                {},
                !tool.read && !needsLoad,
              );
            }}
          >
            <div className="tool-fields">
              {tool.fields.map((f) =>
                typeof values[f.key] === 'boolean' ? (
                  <label className="tool-check" key={f.key}>
                    <input
                      type="checkbox"
                      checked={!!values[f.key]}
                      disabled={busy}
                      onChange={(e) => set(f.key, e.target.checked)}
                    />
                    {f.label}
                  </label>
                ) : (
                  <label
                    className={f.multiline ? 'tool-field full' : 'tool-field'}
                    key={f.key}
                  >
                    {f.label}
                    {f.optional && <small>Optional</small>}
                    {f.options ? (
                      <select
                        aria-label={f.label}
                        value={String(values[f.key])}
                        disabled={busy}
                        onChange={(e) => set(f.key, e.target.value)}
                      >
                        {f.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : f.multiline ? (
                      <textarea
                        aria-label={f.label}
                        rows={5}
                        value={String(values[f.key])}
                        disabled={busy}
                        required={!f.optional}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    ) : (
                      <input
                        aria-label={f.label}
                        value={String(values[f.key])}
                        disabled={busy}
                        required={!f.optional}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                  </label>
                ),
              )}
            </div>
            {!tool.read && !needsLoad && (
              <label className="tool-check confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {tool.danger
                  ? 'I understand the changes described above and confirm this operation.'
                  : 'I reviewed the options and want to apply this change.'}
              </label>
            )}
            <button
              className="primary"
              disabled={busy || (!tool.read && !needsLoad && !confirmed)}
            >
              {busy
                ? 'Working…'
                : needsLoad
                  ? 'Load for review'
                  : tool.read
                    ? 'Inspect'
                    : tool.name}
            </button>
          </form>
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          {loaded && tool.editor === 'rebase' && (
            <div className="rebase-plan" aria-label="Rebase plan">
              {plan.map((entry, index) => (
                <div key={entry.id}>
                  <select
                    aria-label={`Action for ${entry.subject}`}
                    value={entry.action}
                    onChange={(e) => {
                      setPlan((p) =>
                        p.map((v, i) =>
                          i === index ? { ...v, action: e.target.value } : v,
                        ),
                      );
                      setConfirmed(false);
                    }}
                  >
                    {['pick', 'edit', 'squash', 'fixup', 'drop'].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <code>{entry.id.slice(0, 8)}</code>
                  <span>{entry.subject}</span>
                  {[-1, 1].map((offset) => (
                    <button
                      key={offset}
                      aria-label={`Move ${entry.subject} ${offset < 0 ? 'up' : 'down'}`}
                      disabled={
                        busy ||
                        index + offset < 0 ||
                        index + offset >= plan.length
                      }
                      onClick={() => {
                        setPlan((p) => {
                          const next = [...p];
                          [next[index], next[index + offset]] = [
                            next[index + offset],
                            next[index],
                          ];
                          return next;
                        });
                        setConfirmed(false);
                      }}
                    >
                      {offset < 0 ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {loaded && (tool.editor === 'file' || tool.editor === 'conflict') && (
            <>
              {tool.editor === 'conflict' && (
                <div className="conflict-sides">
                  {(['base', 'ours', 'theirs'] as const).map((side) => (
                    <details key={side}>
                      <summary>{side}</summary>
                      <pre>
                        {result?.[side] || '(No version at this stage)'}
                      </pre>
                      {side !== 'base' && (
                        <button
                          onClick={() => {
                            setContent(result?.[side] ?? '');
                            setConfirmed(false);
                          }}
                        >
                          Use {side} as result
                        </button>
                      )}
                    </details>
                  ))}
                </div>
              )}
              <label className="tool-field">
                {tool.editor === 'file'
                  ? 'File contents'
                  : 'Resolved file contents'}
                <textarea
                  className="code-editor"
                  rows={14}
                  value={content}
                  disabled={busy}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
            </>
          )}
          {loaded && tool.editor === 'hunks' && (
            <div className="line-stage" aria-label="Select diff lines">
              {parsed.hunks.length === 0 ? (
                <p>
                  No editable text hunks. Untracked or binary files must be
                  staged as whole files.
                </p>
              ) : (
                parsed.hunks.map((h, i) => (
                  <section key={i}>
                    <button
                      onClick={() => {
                        setLines((old) => {
                          const next = new Set(old);
                          const changes = h.lines.filter((l) =>
                            /^[+-]/.test(l.text),
                          );
                          const all = changes.every((l) => next.has(l.id));
                          changes.forEach((l) =>
                            all ? next.delete(l.id) : next.add(l.id),
                          );
                          return next;
                        });
                        setConfirmed(false);
                      }}
                    >
                      Toggle hunk {i + 1}
                    </button>
                    <code>{h.header}</code>
                    {h.lines.map((l) => (
                      <label
                        key={l.id}
                        className={
                          l.text.startsWith('+')
                            ? 'line-add'
                            : l.text.startsWith('-')
                              ? 'line-remove'
                              : ''
                        }
                      >
                        {/^[+-]/.test(l.text) ? (
                          <input
                            type="checkbox"
                            aria-label={`Select line ${l.id + 1}: ${l.text}`}
                            checked={lines.has(l.id)}
                            onChange={() => {
                              setLines((old) => {
                                const next = new Set(old);
                                if (next.has(l.id)) next.delete(l.id);
                                else next.add(l.id);
                                return next;
                              });
                              setConfirmed(false);
                            }}
                          />
                        ) : (
                          <span />
                        )}
                        <code>{l.text}</code>
                      </label>
                    ))}
                  </section>
                ))
              )}
            </div>
          )}
          {loaded && needsLoad && (
            <div className="tool-editor-actions">
              <label className="tool-check confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I reviewed the result and confirm this change.
              </label>
              <button
                className="primary"
                disabled={
                  busy || !confirmed || (tool.editor === 'hunks' && !lines.size)
                }
                onClick={applyEditor}
              >
                {tool.editor === 'rebase'
                  ? 'Start interactive rebase'
                  : tool.editor === 'hunks'
                    ? values.flag
                      ? 'Unstage selected lines'
                      : 'Stage selected lines'
                    : 'Save file'}
              </button>
            </div>
          )}
          {!busy && result && (!loaded || !needsLoad) && (
            <section className="tool-output" aria-label="Operation result">
              <div className="tool-result-heading">
                <strong>{tool.read ? 'Result' : 'Operation result'}</strong>
                <span className="spacer" />
                <button
                  aria-label="Copy result"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(result.text)
                      .catch((e) => setError(String(e)))
                  }
                >
                  <Copy size={14} />
                </button>
                <button aria-label="Save result" onClick={download}>
                  <Download size={14} />
                </button>
              </div>
              {result.id && (
                <p>
                  Object ID: <code>{result.id}</code>
                </p>
              )}
              <pre>{result.text || 'Completed successfully.'}</pre>
            </section>
          )}
        </section>
      </div>
    </Modal>
  );
}
