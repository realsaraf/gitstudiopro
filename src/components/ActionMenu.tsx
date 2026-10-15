import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export interface MenuAction {
  label: string;
  run: () => void;
  disabled?: boolean;
}
/** One keyboard-accessible menu shared by repository, branch, commit and stash actions. */
export function ActionMenu({
  label,
  items,
  disabled = false,
  openAt,
  onDismiss,
}: {
  label: string;
  items: MenuAction[];
  disabled?: boolean;
  openAt?: { left: number; top: number };
  onDismiss?: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  useEffect(() => {
    if (openAt && !disabled)
      setPosition({
        left: Math.max(8, Math.min(openAt.left, innerWidth - 288)),
        top: Math.max(
          8,
          Math.min(
            openAt.top,
            innerHeight - Math.min(items.length * 42 + 16, 400) - 8,
          ),
        ),
      });
  }, [openAt, disabled, items.length]);
  const close = () => {
    setPosition(undefined);
    onDismiss?.();
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!position) return;
    menu.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      ) {
        setPosition(undefined);
        onDismiss?.();
      }
    };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [position]);
  return (
    <>
      <button
        ref={trigger}
        className="icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!position}
        disabled={disabled}
        onClick={() => {
          if (position) close();
          else {
            const rect = trigger.current!.getBoundingClientRect();
            setPosition({
              left: Math.max(8, Math.min(rect.right - 280, innerWidth - 288)),
              top: Math.max(
                8,
                Math.min(
                  rect.bottom + 4,
                  innerHeight - Math.min(items.length * 42 + 16, 400) - 8,
                ),
              ),
            });
          }
        }}
      >
        <MoreHorizontal size={19} />
      </button>
      {position &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            className="action-menu"
            style={position}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setPosition(undefined);
                onDismiss?.();
              }
            }}
            onKeyDown={(event) => {
              const buttons = Array.from(
                menu.current!.querySelectorAll<HTMLButtonElement>(
                  'button:not(:disabled)',
                ),
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (event.key === 'Escape' || event.key === 'Tab') {
                event.preventDefault();
                event.stopPropagation();
                close();
              } else if (
                ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? buttons.length - 1
                      : (index +
                          (event.key === 'ArrowDown' ? 1 : -1) +
                          buttons.length) %
                        buttons.length;
                buttons[next]?.focus();
              }
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.run();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
