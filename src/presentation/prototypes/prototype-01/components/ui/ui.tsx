/**
 * The small shared primitives every Room composes from.
 *
 * Each does exactly one job: an eyebrow labels, a chip states, an action navigates or
 * acts. When one of them starts doing two of those, it gets split rather than extended.
 */
import type { ReactNode } from 'react';
import './ui.css';
import { KIND_LABEL, type ObjectKind } from '../../object-graph/contract';

/** The object-kind label that precedes every title in the application. */
export function Eyebrow({ kind, suffix }: { kind: ObjectKind; suffix?: string }) {
  return (
    <span className="eyebrow">
      {KIND_LABEL[kind] ?? kind}
      {suffix ? ` · ${suffix}` : ''}
    </span>
  );
}

/**
 * State as a word plus a shape. Colour reinforces; it never carries the meaning alone,
 * which is what keeps the interface readable without colour vision.
 */
export function StateChip({ state, tone }: { state: string; tone?: 'settled' | 'blocked' | 'active' }) {
  const resolved =
    tone ??
    (['done', 'completed', 'resolved', 'answered', 'ended'].includes(state)
      ? 'settled'
      : ['blocked', 'failed', 'paused'].includes(state)
        ? 'blocked'
        : ['active', 'doing', 'running', 'live'].includes(state)
          ? 'active'
          : undefined);
  return (
    <span className="state-chip" data-tone={resolved ?? 'neutral'}>
      <span className="state-chip__mark" aria-hidden="true" />
      {state}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'quiet' | 'ghost';
  disabled?: boolean;
  title?: string;
};

/** Acts on state in place. It never changes which Room you are in. */
export function ActionButton({ children, onClick, variant = 'quiet', disabled, title }: ButtonProps) {
  return (
    <button
      type="button"
      className="action-button"
      data-variant={variant}
      disabled={disabled}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/**
 * The explicit navigation control. Every one of these is labelled with where it goes,
 * and nothing else in the application moves the user.
 */
export function RoomAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="room-action"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
      <span className="room-action__arrow" aria-hidden="true">
        ↗
      </span>
    </button>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className="search-field"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function FilterGroup({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="filter-group" role="group">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="filter-group__option"
          data-current={value === option}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** An empty screen is an invitation to act, never a statement of absence. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}

/** A labelled fact inside an inspector or a card. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field-row">
      <span className="field-row__label">{label}</span>
      <span className="field-row__value">{children}</span>
    </div>
  );
}
