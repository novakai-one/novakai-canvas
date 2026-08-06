import type { ReactNode } from 'react';

/**
 * How much of a name is protected from truncation.
 *
 * Long enough to tell four "Mission Control UX 22-Jul — …" rows apart, short enough that the
 * head still shows what family a diagram belongs to at the rail's minimum width.
 */
const TAIL_LENGTH = 16;

export function tail(label: string): string {
  return label.length <= TAIL_LENGTH ? label : label.slice(-TAIL_LENGTH);
}

export function head(label: string): string {
  return label.length <= TAIL_LENGTH ? '' : label.slice(0, -TAIL_LENGTH);
}

/**
 * One navigation row in the rail.
 *
 * A rail row is travel, not inspection: clicking it moves you somewhere. The active row carries
 * the rail's single gold mark — the one thing on this edge of the screen that is lit — and every
 * other row stays quiet. A per-row action appears only under the pointer, so a list of eighteen
 * diagrams never becomes eighteen competing controls.
 */
export function RailRow({
  action, active, label, onTravel,
}: {
  label: string;
  active: boolean;
  onTravel: () => void;
  action?: ReactNode;
}) {
  return (
    <li className="rail-row" data-active={active || undefined}>
      <button
        aria-current={active ? 'true' : undefined}
        className="rail-travel"
        onClick={onTravel}
        title={label}
        type="button"
      >
        <span aria-hidden className="rail-mark" />
        {/*
          * The end of the name survives, not just the start.
          *
          * Four of Chris's diagrams begin "Mission Control UX 22-Jul — ", so plain end-ellipsis
          * rendered them as four identical rows: unreadable exactly as he described, and worse
          * than unreadable because they looked like duplicates. The head gives way and the tail
          * — which is what actually distinguishes them — is always drawn.
          */}
        <span className="rail-label">
          <span className="rail-label-head">{head(label)}</span>
          <span className="rail-label-tail">{tail(label)}</span>
        </span>
      </button>
      {action}
    </li>
  );
}

/** A trailing control on a rail row; present in the markup, visible only on hover or focus. */
export function RailAction({
  glyph, label, onClick,
}: {
  glyph: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={label} className="rail-action" onClick={onClick} title={label} type="button">
      <span aria-hidden>{glyph}</span>
    </button>
  );
}
