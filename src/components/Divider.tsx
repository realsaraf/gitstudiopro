import { useRef } from 'react';
export function Divider({
  direction,
  value,
  onChange,
  min,
  max,
  label,
  reset,
}: {
  direction: 'vertical' | 'horizontal';
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
  reset: number;
}) {
  const start = useRef({ position: 0, value: 0, scale: 1 });
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={direction}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`divider ${direction}`}
      onDoubleClick={() => onChange(reset)}
      onKeyDown={(e) => {
        if (
          ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key)
        ) {
          e.preventDefault();
          onChange(
            Math.min(
              max,
              Math.max(
                min,
                value +
                  (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) *
                    (direction === 'vertical' ? 10 : 2),
              ),
            ),
          );
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = {
          position: direction === 'vertical' ? e.clientX : e.clientY,
          value,
          scale:
            direction === 'vertical'
              ? 1
              : 100 / (e.currentTarget.parentElement?.clientHeight ?? 800),
        };
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const position = direction === 'vertical' ? e.clientX : e.clientY;
        onChange(
          Math.min(
            max,
            Math.max(
              min,
              start.current.value +
                (position - start.current.position) * start.current.scale,
            ),
          ),
        );
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    />
  );
}
