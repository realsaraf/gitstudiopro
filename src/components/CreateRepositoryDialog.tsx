import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { native } from '../api';
import { Modal } from './Modal';
export function CreateRepositoryDialog({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (path: string) => void;
}) {
  const [mode, setMode] = useState('clone');
  const [destination, setDestination] = useState('');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [depth, setDepth] = useState(0);
  const [recursive, setRecursive] = useState(false);
  const [singleBranch, setSingleBranch] = useState(false);
  const [bare, setBare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  return (
    <Modal
      title="Clone or initialize repository"
      subtitle="Create a repository in a new directory."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setResult('');
          try {
            if (!native)
              throw new Error(
                'Creating repositories requires the desktop app.',
              );
            const result = await invoke<{ path: string; bare: boolean }>(
              'create_repository',
              {
                options: {
                  destination,
                  url: mode === 'clone' ? url : null,
                  branch,
                  depth,
                  recursive,
                  singleBranch,
                  bare,
                },
              },
            );
            if (result.bare)
              setResult(
                `Bare repository created at ${result.path}. Bare repositories have no working directory to open.`,
              );
            else onOpen(result.path);
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="tool-fields">
          <label className="tool-field">
            Operation
            <select
              aria-label="Operation"
              value={mode}
              disabled={busy}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="clone">Clone repository</option>
              <option value="init">Initialize repository</option>
            </select>
          </label>
          <label className="tool-field full">
            New destination path
            <input
              data-autofocus
              required
              disabled={busy}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Absolute path to a new directory"
            />
          </label>
          {mode === 'clone' && (
            <label className="tool-field full">
              Source URL or path
              <input
                required
                disabled={busy}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          )}
          <label className="tool-field">
            {mode === 'clone' ? 'Branch (optional)' : 'Initial branch'}
            <input
              disabled={busy}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={mode === 'init' ? 'main' : 'Remote default'}
            />
          </label>
          {mode === 'clone' && (
            <>
              <label className="tool-field">
                Depth (0 for complete history)
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={depth}
                  disabled={busy}
                  onChange={(e) => setDepth(Number(e.target.value))}
                />
              </label>
              <label className="tool-check">
                <input
                  type="checkbox"
                  checked={recursive}
                  disabled={busy}
                  onChange={(e) => setRecursive(e.target.checked)}
                />
                Initialize submodules recursively
              </label>
              <label className="tool-check">
                <input
                  type="checkbox"
                  checked={singleBranch}
                  disabled={busy}
                  onChange={(e) => setSingleBranch(e.target.checked)}
                />
                Single branch
              </label>
            </>
          )}
          <label className="tool-check">
            <input
              type="checkbox"
              checked={bare}
              disabled={busy}
              onChange={(e) => setBare(e.target.checked)}
            />
            Bare repository (no working files)
          </label>
        </div>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {result && <p role="status">{result}</p>}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy
              ? 'Creating…'
              : mode === 'clone'
                ? 'Clone repository'
                : 'Initialize repository'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
