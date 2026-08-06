import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** One choice a flyout offers. */
export interface FlyoutItem {
  id: string;
  label: string;
  /** One quiet line under the label, for choices whose names are not self-explaining. */
  hint?: string;
}

export interface FlyoutProps {
  label: string;
  items: readonly FlyoutItem[];
  onPick: (id: string) => void;
  /** The id currently in force, marked in the list so the row's own label is never a guess. */
  current?: string;
  /** The row that opens it. */
  children: React.ReactNode;
}

/**
 * A short list of choices that opens *beside* the row that owns it.
 *
 * The distinction from an accordion section is the whole point: expanding in place pushes every
 * row below it down, and a menu whose rows move under the hand is the thing Chris described as
 * "my whole left menu keeps moving". A flyout is drawn over its neighbours, so the panel behind
 * it is exactly as it was before and exactly as it will be after.
 *
 * Escape and an outside click both close it; picking closes it too, because a choice made is a
 * question answered.
 */
export function Flyout({ children, current, items, label, onPick }: FlyoutProps) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, right: 0 });
  const root = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (root.current?.contains(target) || menu.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="flyout" data-open={open || undefined} ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flyout-trigger"
        onClick={(event) => {
          /*
           * Measured at the moment of opening, and drawn outside the panel.
           *
           * A menu rendered inside the panel is clipped by the panel's own scroll box — it was
           * present, measurable, and invisible, which is the worst of the three states. Fixed
           * position against the trigger's rect puts it over everything while still reading as
           * belonging to the row that opened it.
           */
          const box = event.currentTarget.getBoundingClientRect();
          setAt({ top: box.bottom + 4, right: window.innerWidth - box.right });
          setOpen((value) => !value);
        }}
        type="button"
      >
        {children}
        <span aria-hidden className="flyout-mark">›</span>
      </button>
      {open && createPortal(
        <div className="flyout-menu" ref={menu} role="menu" style={{ top: at.top, right: at.right }}>
          <span className="flyout-menu-title">{label}</span>
          {items.map((item) => (
            <button
              data-current={item.id === current || undefined}
              key={item.id}
              onClick={() => { onPick(item.id); setOpen(false); }}
              role="menuitem"
              type="button"
            >
              <span className="flyout-item-label">{item.label}</span>
              {item.hint && <span className="flyout-item-hint">{item.hint}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
