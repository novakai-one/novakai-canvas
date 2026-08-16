/**
 * The plane itself: ground, seam, ruler and horizon.
 *
 * The ground is inscribed rather than empty — the wait ruler lies flat on it and names
 * its own axis, and the field's title lies flat with it so the surface reads as a place
 * you are standing on. The seam is the light source: it is the turn boundary, and every
 * block's shadow falls away from it.
 */
import { useState } from 'react';
import type { FieldLayout } from './turn-line-geometry';
import type { TurnHolder, TurnLineThread } from './turn-line-model';
import { formatWait } from './turn-line-model';
import { TurnLineMarker, type MarkerTone } from './TurnLineMarker';

function OverflowCluster({
  side,
  threads,
  layout,
  onSelect,
}: {
  side: TurnHolder;
  threads: readonly TurnLineThread[];
  layout: FieldLayout;
  onSelect: (threadId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const direction = side === 'you' ? -1 : 1;

  return (
    <div
      className="tl-overflow"
      data-side={side}
      style={{
        left: `${layout.seamX + direction * (layout.seamX * 0.88)}px`,
        top: `${layout.planeTop - 30}px`,
      }}
    >
      <button
        type="button"
        className="tl-overflow__handle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {`+${threads.length} further back`}
      </button>
      {expanded && (
        <ul className="tl-overflow__list">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button type="button" onClick={() => onSelect(thread.id)}>
                <span>{thread.name}</span>
                <span className="tl-overflow__wait">{formatWait(thread.waitMs)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TurnLineField({
  layout,
  toneFor,
  openThreadId,
  onSelect,
  holdingCount,
  needsYou,
  clock,
  onStartConversation,
}: {
  layout: FieldLayout;
  toneFor: (threadId: string) => MarkerTone;
  openThreadId: string | null;
  onSelect: (threadId: string) => void;
  holdingCount: number;
  needsYou: boolean;
  clock: string;
  onStartConversation: () => void;
}) {
  return (
    <div className="tl-field">
      <div className="tl-field__sky" aria-hidden="true" />
      <div className="tl-field__ground" aria-hidden="true">
        <span className="tl-field__wordmark">Turn line</span>
      </div>

      {/* The wait axis, lying on the ground and labelled in its own units. */}
      <div className="tl-field__ruler" aria-hidden="true">
        {layout.ticks.map((tick) => (
          <span key={tick.label}>
            <i style={{ left: `${layout.seamX - tick.offset}px` }} data-label={tick.label} />
            <i style={{ left: `${layout.seamX + tick.offset}px` }} data-label={tick.label} />
          </span>
        ))}
      </div>

      <div className="tl-field__seam" style={{ left: `${layout.seamX}px` }} aria-hidden="true" />
      <p className="tl-field__side-label" data-side="you" style={{ right: `calc(100% - ${layout.seamX}px + 18px)` }}>
        Your move
      </p>
      <p className="tl-field__side-label" data-side="them" style={{ left: `${layout.seamX + 18}px` }}>
        Their move
      </p>

      <div className="tl-field__markers">
        {layout.placed.map((placed) => (
          <TurnLineMarker
            key={placed.thread.id}
            placed={placed}
            tone={toneFor(placed.thread.id)}
            open={placed.thread.id === openThreadId}
            onSelect={() => onSelect(placed.thread.id)}
          />
        ))}
      </div>

      {(['you', 'them'] as const).map((side) =>
        layout.overflow[side].length > 0 ? (
          <OverflowCluster
            key={side}
            side={side}
            threads={layout.overflow[side]}
            layout={layout}
            onSelect={onSelect}
          />
        ) : null,
      )}

      <dl className="tl-field__legend">
        <dt>Wait</dt>
        <dd data-tier="now">now</dd>
        <dd data-tier="hours">hours</dd>
        <dd data-tier="days">days</dd>
      </dl>

      <p className="tl-field__status">
        <span>{`${holdingCount} on you`}</span>
        {needsYou && <span data-attention="true">1 needs you</span>}
        <span className="tl-field__clock">{clock}</span>
      </p>

      <button type="button" className="tl-field__start" onClick={onStartConversation}>
        Start a conversation
      </button>
    </div>
  );
}
