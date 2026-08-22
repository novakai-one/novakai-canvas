import { useEffect, useRef } from 'react';
import type { CreatableNodeKind } from '../canvas-actions.ts';
import { connectionCreationEntries } from './connection-creation.ts';

/** Choice shown only after a wire end lands on empty canvas. */
export function ConnectionCreationPicker(props: {
  at: { x: number; y: number };
  cancel: () => void;
  pick: (kind: CreatableNodeKind) => void;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const { cancel } = props;
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) cancel();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancel();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cancel]);
  return (
    <div
      aria-label="Create connected object"
      className="connection-create"
      ref={root}
      role="dialog"
      style={{ left: props.at.x, top: props.at.y }}
    >
      <span className="connection-create__title">Connect to</span>
      {connectionCreationEntries.map((entry) => (
        <button key={entry.id} onClick={() => props.pick(entry.id)} type="button">
          <span>{entry.label}</span>
          <small>{entry.hint}</small>
        </button>
      ))}
      <span className="connection-create__hint">Esc cancels</span>
    </div>
  );
}
