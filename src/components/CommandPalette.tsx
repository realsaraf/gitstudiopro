import { useEffect, useId, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Modal } from './Modal';
import { searchCommands } from '../lib/commands';
import type { PaletteCommand } from '../lib/commands';

export function CommandPalette({
  commands,
  onClose,
}: {
  commands: PaletteCommand[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const filtered = searchCommands(commands, query);
  const activeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const selected = filtered[activeIndex];
  const selectedId = selected ? `${listId}-${selected.id}` : undefined;
  useEffect(() => {
    if (selectedId)
      document.getElementById(selectedId)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);
  return (
    <Modal
      title="Command palette"
      onClose={onClose}
      className="command-palette-modal"
    >
      <div className="palette-search">
        <Search size={23} />
        <input
          data-autofocus
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={selectedId}
          placeholder="Search commands, themes, settings…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
            if (list.current) list.current.scrollTop = 0;
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (
              ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)
            ) {
              event.preventDefault();
              const step = event.key.startsWith('Page') ? 5 : 1;
              const direction = event.key.endsWith('Down') ? 1 : -1;
              if (filtered.length)
                setIndex(
                  (activeIndex + direction * step + filtered.length * 5) %
                    filtered.length,
                );
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              if (selected && !selected.disabled) selected.run();
            }
          }}
        />
        <kbd>esc</kbd>
      </div>
      <div className="section-label palette-count" role="status">
        {filtered.length} commands
      </div>
      <div
        ref={list}
        className="command-list"
        id={listId}
        role="listbox"
        aria-label="Commands"
      >
        {filtered.map((command, i) => (
          <div
            key={command.id}
            id={`${listId}-${command.id}`}
            role="option"
            aria-selected={i === activeIndex}
            aria-disabled={!!command.disabled}
            className={`command-item ${i === activeIndex ? 'active' : ''}`}
            onPointerMove={() => {
              if (i !== activeIndex) setIndex(i);
            }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!command.disabled) command.run();
            }}
          >
            <span className="command-icon" aria-hidden="true">
              {command.swatch ? (
                <span
                  className="theme-swatch"
                  style={{ background: command.swatch }}
                />
              ) : (
                <command.icon size={23} />
              )}
            </span>
            <span>
              <strong>{command.name}</strong>
              <small>
                {command.group} · {command.disabled || command.detail}
              </small>
            </span>
            {command.selected && (
              <span className="command-current">
                <Check size={15} />
                Current
              </span>
            )}
            {command.keys && <kbd>{command.keys}</kbd>}
          </div>
        ))}
      </div>
      {!filtered.length && (
        <p className="subtle-empty">
          No matching commands. Try “theme”, “font”, or “settings”.
        </p>
      )}
      <div className="palette-footer">
        <kbd>↑</kbd>
        <kbd>↓</kbd> to navigate <kbd>↵</kbd> to run
        <span className="spacer" />
        Esc to close
      </div>
    </Modal>
  );
}
