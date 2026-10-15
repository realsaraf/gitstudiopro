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
import { themes } from '../themes';
import { useSettings, updateSettings, resetLayout } from '../settings';
import { credits } from '../theme-credits';
import { HostPanel } from './HostPanel';
export type PreferencesTab = 'Appearance' | 'Intelligence' | 'Repository hosts';
export function Preferences({
  onClose,
  initialTab = 'Appearance',
  initialSection = '',
}: {
  onClose: () => void;
  initialTab?: PreferencesTab;
  initialSection?: string;
}) {
  const [tab, setTab] = useState<PreferencesTab>(initialTab);
  const {
    theme,
    fontSize: size,
    reduceMotion: motion,
    splitDiff,
  } = useSettings();
  const [filter, setFilter] = useState('All');
  return (
    <Modal
      title="Preferences"
      subtitle="Make this workspace feel like yours."
      onClose={onClose}
      wide
    >
      <div className="settings-tabs" role="tablist">
        {(['Appearance', 'Intelligence', 'Repository hosts'] as const).map(
          (name, index, tabs) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === name}
              id={`settings-tab-${index}`}
              aria-controls="settings-panel"
              tabIndex={tab === name ? 0 : -1}
              data-autofocus={
                tab === name && !initialSection ? true : undefined
              }
              className={tab === name ? 'active' : ''}
              onClick={() => setTab(name)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === 'ArrowRight')
                  next = (index + 1) % tabs.length;
                else if (event.key === 'ArrowLeft')
                  next = (index + tabs.length - 1) % tabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = tabs.length - 1;
                else return;
                event.preventDefault();
                setTab(tabs[next]);
                document.getElementById(`settings-tab-${next}`)?.focus();
              }}
            >
              {name}
            </button>
          ),
        )}
      </div>
      {tab === 'Appearance' ? (
        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby="settings-tab-0"
          className="settings-content"
        >
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
                  updateSettings({ fontSize: value });
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
            <button onClick={resetLayout}>Reset layout</button>
          </section>
          <section className="setting-card inline-setting">
            <div>
              <h3>Diff layout</h3>
              <p>Remember your preferred layout across tabs and restarts.</p>
            </div>
            <select
              aria-label="Default diff layout"
              value={splitDiff ? 'split' : 'unified'}
              onChange={(event) =>
                updateSettings({ splitDiff: event.target.value === 'split' })
              }
            >
              <option value="split">Side by side</option>
              <option value="unified">Unified</option>
            </select>
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
                      updateSettings({ theme: i });
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
                updateSettings({ reduceMotion: e.target.checked });
              }}
            />
          </section>
          <details
            className="license-credits"
            open={initialSection === 'licenses' || undefined}
          >
            <summary
              data-autofocus={initialSection === 'licenses' || undefined}
            >
              Open-source credits &amp; licenses
            </summary>
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
      ) : tab === 'Repository hosts' ? (
        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby="settings-tab-2"
          className="settings-content"
        >
          <HostPanel />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={`settings-tab-${tab === 'Intelligence' ? 1 : 2}`}
          className="integration-state"
        >
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
