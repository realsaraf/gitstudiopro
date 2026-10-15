import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { native, readSaved, save } from '../api';
interface Pull {
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: string;
  head: { sha: string; ref: string };
  base: { ref: string };
  user: { login: string };
}
interface PullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}
type HostAction =
  | 'status'
  | 'saveToken'
  | 'deleteToken'
  | 'test'
  | 'listPulls'
  | 'readPull'
  | 'pullFiles'
  | 'createPull'
  | 'comment'
  | 'review'
  | 'mergePull'
  | 'fork';
export function HostPanel() {
  const [baseUrl, setBaseUrl] = useState(() =>
    readSaved('host-url', 'https://api.github.com'),
  );
  const [repository, setRepository] = useState(() =>
    readSaved('host-repository', ''),
  );
  const [token, setToken] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pulls, setPulls] = useState<Pull[]>([]);
  const [pull, setPull] = useState<Pull>();
  const [files, setFiles] = useState<PullFile[]>([]);
  const [page, setPage] = useState(1);
  const [filePage, setFilePage] = useState(1);
  const [title, setTitle] = useState('');
  const [head, setHead] = useState('');
  const [base, setBase] = useState('main');
  const [body, setBody] = useState('');
  const [action, setAction] = useState<HostAction>('createPull');
  const [mode, setMode] = useState('COMMENT');
  const [confirmed, setConfirmed] = useState(false);
  async function call<T>(
    action: HostAction,
    extra: Record<string, unknown> = {},
  ): Promise<T> {
    if (!native) throw new Error('Repository hosts require the desktop app.');
    return invoke('host_request', {
      request: { action, baseUrl, repository, ...extra },
    });
  }
  useEffect(() => {
    setToken('');
    setConfigured(false);
    setPull(undefined);
    setPulls([]);
    setFiles([]);
    setConfirmed(false);
    let active = true;
    void call<{ configured: boolean }>('status')
      .then((r) => {
        if (active) setConfigured(r.configured);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [baseUrl]);
  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function list(next = 1) {
    const result = await call<Pull[]>('listPulls', { page: next });
    setPulls(result);
    setPage(next);
    save('host-repository', repository);
    setNotice(`Loaded ${result.length} pull requests.`);
  }
  async function inspect(number: number) {
    const selected = await call<Pull>('readPull', { number });
    setPull(selected);
    setFiles([]);
    setConfirmed(false);
    setFilePage(1);
  }
  const write = () =>
    perform(async () => {
      const result = await call<Record<string, unknown>>(action, {
        number: pull?.number ?? 0,
        title,
        body,
        head: action === 'mergePull' ? pull?.head.sha : head,
        base,
        mode,
        confirmed,
      });
      setConfirmed(false);
      setNotice(
        `Completed ${action}.${typeof result.html_url === 'string' ? ` ${result.html_url}` : ''}`,
      );
      if (action === 'mergePull' || action === 'createPull') await list();
    });
  return (
    <div className="host-panel">
      <section className="setting-card">
        <h3>GitHub / GitHub Enterprise</h3>
        <p>
          Connect directly to a host API. Tokens are stored in the operating
          system credential manager, separately for each API URL. Git fetch/push
          authentication is separate.
        </p>
        <div className="tool-fields">
          <label className="tool-field full">
            API base URL
            <input
              aria-label="API base URL"
              value={baseUrl}
              disabled={busy}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.github.com"
            />
          </label>
          <label className="tool-field full">
            Access token{' '}
            <small>
              {configured
                ? 'Configured — leave blank to keep it'
                : 'Not configured — public repositories can be read anonymously'}
            </small>
            <input
              type="password"
              autoComplete="off"
              aria-label="Host access token"
              value={token}
              disabled={busy}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </div>
        <div className="toolbar">
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (token) {
                  await call('saveToken', { token });
                  setToken('');
                  setConfigured(true);
                } else {
                  await call('status');
                }
                save('host-url', baseUrl);
                setNotice('Connection settings saved.');
              })
            }
          >
            Save host connection
          </button>
          <button
            disabled={busy || !configured}
            onClick={() =>
              void perform(async () => {
                await call('deleteToken');
                setConfigured(false);
                setNotice('Stored token removed.');
              })
            }
          >
            Remove token
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const result = await call<{ login: string }>('test');
                setNotice(`Connected as ${result.login}.`);
              })
            }
          >
            Test connection
          </button>
        </div>
      </section>
      <section className="setting-card">
        <h3>Pull requests</h3>
        <div className="tool-fields">
          <label className="tool-field full">
            Repository (owner/name)
            <input
              aria-label="Host repository"
              value={repository}
              disabled={busy}
              onChange={(e) => {
                setRepository(e.target.value);
                setPull(undefined);
                setPulls([]);
                setFiles([]);
                setConfirmed(false);
              }}
              placeholder="owner/repository"
            />
          </label>
        </div>
        <button
          className="primary"
          disabled={busy || !repository}
          onClick={() => void perform(() => list())}
        >
          Load pull requests
        </button>
        <div className="host-pulls">
          {pulls.map((p) => (
            <button
              key={p.number}
              disabled={busy}
              className={pull?.number === p.number ? 'active' : ''}
              onClick={() => void perform(() => inspect(p.number))}
            >
              <span className="accent">#{p.number}</span>
              <strong>{p.title}</strong>
              <small>
                {p.user.login} · {p.head.ref} → {p.base.ref}
              </small>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <button
            disabled={busy || page <= 1}
            onClick={() => void perform(() => list(page - 1))}
          >
            Previous page
          </button>
          <span>Page {page}</span>
          <button
            disabled={busy || pulls.length < 50}
            onClick={() => void perform(() => list(page + 1))}
          >
            Next page
          </button>
        </div>
      </section>
      {pull && (
        <section className="setting-card">
          <h3>
            #{pull.number} · {pull.title}
          </h3>
          <p>
            {pull.state} · {pull.head.ref} → {pull.base.ref}
          </p>
          <p className="mono">{pull.head.sha}</p>
          <pre className="host-description">
            {pull.body || 'No description.'}
          </pre>
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                setFiles(
                  await call<PullFile[]>('pullFiles', {
                    number: pull.number,
                    page: filePage,
                  }),
                );
                setNotice(`Loaded file page ${filePage}.`);
              })
            }
          >
            Load changed files
          </button>
          <label className="tool-field">
            File page
            <input
              type="number"
              min={1}
              value={filePage}
              onChange={(e) => setFilePage(Math.max(1, Number(e.target.value)))}
            />
          </label>
          {files.map((f) => (
            <details key={f.filename}>
              <summary>
                {f.filename} · {f.status} · +{f.additions} −{f.deletions}
              </summary>
              <pre className="host-patch">
                {f.patch ??
                  'Patch not supplied by host (binary, large or unchanged content).'}
              </pre>
            </details>
          ))}
        </section>
      )}
      <section className="setting-card">
        <h3>Remote actions</h3>
        <p>
          Review the destination and content before publishing. New pull
          requests are created as drafts.
        </p>
        <div className="tool-fields">
          <label className="tool-field">
            Action
            <select
              aria-label="Host action"
              value={action}
              disabled={busy}
              onChange={(e) => {
                setAction(e.target.value as HostAction);
                setConfirmed(false);
                setMode(e.target.value === 'mergePull' ? 'merge' : 'COMMENT');
              }}
            >
              <option value="createPull">Create draft pull request</option>
              <option value="comment">Comment on selected pull request</option>
              <option value="review">Review selected pull request</option>
              <option value="mergePull">Merge selected pull request</option>
              <option value="fork">Fork repository</option>
            </select>
          </label>
          {action === 'createPull' && (
            <>
              <label className="tool-field">
                Title
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <label className="tool-field">
                Head branch
                <input
                  value={head}
                  onChange={(e) => {
                    setHead(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <label className="tool-field">
                Base branch
                <input
                  value={base}
                  onChange={(e) => {
                    setBase(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
            </>
          )}
          {['createPull', 'comment', 'review'].includes(action) && (
            <label className="tool-field full">
              Content
              <textarea
                aria-label="Content"
                rows={5}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
          )}
          {['review', 'mergePull'].includes(action) && (
            <label className="tool-field">
              Mode
              <select
                aria-label="Host action mode"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setConfirmed(false);
                }}
              >
                {(action === 'review'
                  ? ['COMMENT', 'APPROVE', 'REQUEST_CHANGES']
                  : ['merge', 'squash', 'rebase']
                ).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="tool-check confirmation">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Publish this action to {baseUrl} / {repository}
          {pull && action !== 'createPull' && action !== 'fork'
            ? ` / #${pull.number}`
            : ''}
          .
        </label>
        <button
          className="primary"
          disabled={
            busy ||
            !confirmed ||
            !repository ||
            (!['createPull', 'fork'].includes(action) && !pull)
          }
          onClick={() => void write()}
        >
          Publish remote action
        </button>
      </section>
      {busy && <p role="status">Contacting repository host…</p>}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
