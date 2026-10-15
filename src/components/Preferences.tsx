import { useState } from 'react';
import {
  Check,
  Code2,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Type,
} from 'lucide-react';
import { Modal } from './Modal';
import { applyTheme, themes } from '../themes';
import { readSaved, save } from '../api';
import { credits } from '../theme-credits';
export function Preferences({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('Appearance');
  const [theme, setTheme] = useState(readSaved('theme', 0));
  const [size, setSize] = useState(readSaved('fontSize', 15));
  const [filter, setFilter] = useState('All');
  const [motion, setMotion] = useState(readSaved('reduceMotion', false));
  return (
    <Modal
      title="Preferences"
      subtitle="Make this workspace feel like yours."
      onClose={onClose}
      wide
    >
      <div className="settings-tabs" role="tablist">
        {['Appearance', 'Intelligence', 'Repository hosts'].map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'active' : ''}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === 'Appearance' ? (
        <div role="tabpanel" className="settings-content">
          <section className="setting-card">
            <h3>
              <Type size={18} /> Text size
            </h3>
            <p>Adjust the workspace, including history and code.</p>
            <div className="range-row">
              <span>A</span>
              <input
                aria-label="Text size"
                type="range"
                min="12"
                max="18"
                value={size}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSize(value);
                  save('fontSize', value);
                  document.documentElement.style.fontSize = `${value}px`;
                }}
              />
              <span className="mono">{size} px</span>
            </div>
            <div className="setting-preview">
              <span>Workspace and code text preview.</span>
              <code>const studio = 'hello';</code>
            </div>
          </section>
          <section className="setting-card inline-setting">
            <div>
              <h3>Panel layout</h3>
              <p>Drag a divider to resize. Arrow keys work too.</p>
            </div>
            <button
              onClick={() => {
                save('sidebarWidth', 258);
                save('historyHeight', 48);
                window.dispatchEvent(new Event('reset-layout'));
              }}
            >
              Reset layout
            </button>
          </section>
          <div className="theme-heading">
            <div>
              <h3>Color themes</h3>
              <p>Open-source palettes, adapted for this workspace.</p>
            </div>
            <span className="eyebrow outlined">BUNDLED OFFLINE</span>
          </div>
          <div className="segmented theme-filter">
            {['All', 'Light', 'Dark'].map((f) => (
              <button
                key={f}
                className={filter === f ? 'active' : ''}
                onClick={() => setFilter(f)}
              >
                {f === 'All' ? (
                  <Palette size={14} />
                ) : f === 'Light' ? (
                  <Sun size={14} />
                ) : (
                  <Moon size={14} />
                )}
                {f}
              </button>
            ))}
          </div>
          <div className="theme-grid">
            {themes.map(
              (item, i) =>
                (filter === 'All' || item.dark === (filter === 'Dark')) && (
                  <button
                    key={item.name}
                    className={`theme-card ${theme === i ? 'selected' : ''}`}
                    aria-pressed={theme === i}
                    onClick={() => {
                      setTheme(i);
                      applyTheme(i);
                      save('theme', i);
                    }}
                  >
                    <div
                      className="theme-mini"
                      aria-hidden="true"
                      style={{
                        background: item.bg,
                        color: item.text,
                        borderColor: item.border,
                      }}
                    >
                      <div
                        className="mini-top"
                        style={{ background: item.panel }}
                      >
                        ••• <span>gitstudio pro</span>
                      </div>
                      <div className="mini-body">
                        <div style={{ background: item.panel }}>
                          <i />
                          <i style={{ background: item.accent }} />
                          <i />
                          <i />
                        </div>
                        <section>
                          <small style={{ color: item.accent }}>
                            ● &nbsp; main
                          </small>
                          <code>
                            const studio ={' '}
                            <span style={{ color: item.accent }}>'hello';</span>
                          </code>
                          <i />
                          <i />
                        </section>
                      </div>
                    </div>
                    <strong>{item.name}</strong>
                    <span className="theme-caption">
                      {item.family} · {item.dark ? 'Dark' : 'Light'}{' '}
                      {theme === i ? (
                        <Check className="theme-check" size={17} />
                      ) : item.dark ? (
                        <Moon size={14} />
                      ) : (
                        <Sun size={14} />
                      )}
                    </span>
                  </button>
                ),
            )}
          </div>
          <section className="inline-setting setting-card">
            <div>
              <h3>Reduce motion</h3>
              <p>Keep transitions quiet.</p>
            </div>
            <input
              type="checkbox"
              role="switch"
              aria-label="Reduce motion"
              checked={motion}
              onChange={(e) => {
                setMotion(e.target.checked);
                save('reduceMotion', e.target.checked);
                document.documentElement.dataset.reduceMotion = String(
                  e.target.checked,
                );
              }}
            />
          </section>
          <details className="license-credits">
            <summary>Open-source credits &amp; licenses</summary>
            <p>
              Community palettes belong to their respective authors. These
              adaptations adjust surface, text, and accent roles for GitStudio
              Pro. Studio Day and Studio Dusk are project palettes. No upstream
              endorsement is implied.
            </p>
            {credits.map((credit) => (
              <details key={credit.name}>
                <summary>
                  {credit.name} · {credit.license}
                </summary>
                <p className="mono">{credit.source}</p>
                <pre>{credit.text}</pre>
              </details>
            ))}
          </details>
          <p className="privacy-note">
            <ShieldCheck size={20} /> Local repositories. No telemetry. No
            account required.
          </p>
        </div>
      ) : (
        <div role="tabpanel" className="integration-state">
          <div className="integration-icon">
            {tab === 'Intelligence' ? (
              <Code2 size={30} />
            ) : (
              <ShieldCheck size={30} />
            )}
          </div>
          <h3>
            {tab === 'Intelligence'
              ? 'Your code stays with you'
              : 'Your existing Git authentication'}
          </h3>
          <p>
            {tab === 'Intelligence'
              ? 'AI integration is on the roadmap. This version sends no source code to AI providers and does not collect API keys.'
              : 'Fetch, pull, and push use Git and your configured SSH keys or credential helper. Hosted pull-request review and direct GitHub connections are on the roadmap.'}
          </p>
          <span className="badge">
            {tab === 'Intelligence'
              ? 'Planned · opt-in by design'
              : 'Available · native Git authentication'}
          </span>
        </div>
      )}
    </Modal>
  );
}
