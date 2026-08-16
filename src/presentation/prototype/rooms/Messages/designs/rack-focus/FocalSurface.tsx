/**
 * The reading surface. The corridor is where conversations hang; this flat dock,
 * anchored to the viewport frame and never inside the 3D scene, is where the focused
 * one is actually read and answered. Clicking any referenced object reveals its
 * context on the wall first — opening is always a separate, explicit act.
 */
import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { CorridorPane } from './corridor-model';

/** A chip for one related object: first click reveals context, never navigates. */
function ObjectChip({
  record,
  caption,
  active,
  onReveal,
}: {
  record: ObjectRecord;
  caption: string;
  active: boolean;
  onReveal: (record: ObjectRecord, caption: string, anchor: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      className="rack-chip"
      data-active={active}
      onClick={(event) => onReveal(record, caption, event.currentTarget)}
    >
      <span className="rack-chip__kind">{KIND_LABEL[record.kind]}</span>
      {record.title}
    </button>
  );
}

export function FocalSurface({
  pane,
  revealedId,
  onReveal,
  onSend,
}: {
  pane: CorridorPane | null;
  revealedId: string | null;
  onReveal: (record: ObjectRecord, caption: string, anchor: HTMLElement) => void;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [earlierCount, setEarlierCount] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const turnCount = pane?.turns.length ?? 0;

  // Land at the latest exchange whenever the focused conversation changes or grows.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [pane?.id, turnCount]);

  /** Edges never lie: count the turns that have scrolled out above the fade. */
  const countEarlier = () => {
    const body = bodyRef.current;
    if (!body) return;
    const rows = body.querySelectorAll<HTMLElement>('[data-turn]');
    let above = 0;
    for (const row of rows) {
      if (row.offsetTop + row.offsetHeight < body.scrollTop + 8) above += 1;
    }
    setEarlierCount(above);
  };

  const send = () => {
    if (!pane || !draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  };

  if (!pane) {
    return (
      <aside className="rack-dock" aria-label="Conversation">
        <div className="rack-dock__empty">Focus a pane in the corridor to read it here.</div>
      </aside>
    );
  }

  return (
    <aside className="rack-dock" aria-label={`Conversation with ${pane.agentName}`}>
      <header className="rack-dock__head">
        <span className="rack-dock__avatar">{pane.initials}</span>
        <span className="rack-dock__identity">
          <span className="rack-dock__eyebrow">
            Agent{pane.live && <em className="rack-dock__live"> · live</em>}
          </span>
          <span className="rack-dock__name">{pane.agentName}</span>
        </span>
        <div className="rack-dock__attached">
          {pane.agent && (
            <ObjectChip
              record={pane.agent}
              caption="attached to"
              active={revealedId === pane.agent.id}
              onReveal={onReveal}
            />
          )}
          {pane.mission && (
            <ObjectChip
              record={pane.mission}
              caption="attached to"
              active={revealedId === pane.mission.id}
              onReveal={onReveal}
            />
          )}
        </div>
      </header>

      <div className="rack-dock__body" ref={bodyRef} onScroll={countEarlier}>
        {earlierCount > 0 && <span className="rack-dock__earlier">↑ {earlierCount} earlier</span>}
        {pane.turns.length === 0 && (
          <div className="rack-dock__empty">Say something to start this conversation.</div>
        )}
        {pane.turns.map((turn) => (
          <div className="rack-turn" key={turn.message.id} data-mine={turn.mine} data-turn>
            <span className="rack-turn__meta">
              {turn.speaker} · {turn.time}
            </span>
            <p className="rack-turn__bubble">{field(turn.message, 'body')}</p>
            {turn.citations.length > 0 && (
              <div className="rack-turn__citations">
                {turn.citations.map((cited) => (
                  <ObjectChip
                    key={cited.id}
                    record={cited}
                    caption="referenced here"
                    active={revealedId === cited.id}
                    onReveal={onReveal}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        className="rack-dock__composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          className="rack-dock__input"
          value={draft}
          rows={2}
          placeholder={`Message ${pane.agentName}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="rack-dock__send" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
