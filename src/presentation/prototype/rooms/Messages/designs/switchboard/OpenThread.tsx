/**
 * The raised reading panel: one conversation brought forward while the field stays
 * dimmed behind it. Focus is expressed as depth, not as a modal takeover.
 *
 * Chips select and disclose in place through the tethered ContextCard; the card's
 * `Open` is the only exit. Sending into the amber conversation releases the attention.
 */
import { useEffect, useRef, useState } from 'react';
import { field } from '../../../../object-graph/graph';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignProps } from '../../messages-design';
import { ContextCard } from './ContextCard';
import { ReferenceChip } from './ReferenceChip';

function timeOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

export function OpenThread({
  thread,
  data,
  commands,
  amber,
  released,
  onReleased,
  onClose,
}: {
  thread: ObjectRecord;
  data: MessagesDesignProps['data'];
  commands: MessagesDesignProps['commands'];
  amber: boolean;
  released: boolean;
  onReleased: () => void;
  /** Absent in the thread-Room projection, where this panel is the Room itself. */
  onClose: (() => void) | null;
}) {
  const { graph, selected } = data;
  const [draft, setDraft] = useState('');
  const [tetherY, setTetherY] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const agent = graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'agent');
  const mission = graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'mission');
  const messages = graph
    .relatedOfKind(thread.id, 'contains', 'message')
    .slice()
    .sort((a, b) => (field(a, 'createdAt') < field(b, 'createdAt') ? -1 : 1));

  // The newest exchange is why the panel was raised; keep it in view as it grows.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [messages.length]);

  /** Select an object and remember where its chip sits, so the card can tether to it. */
  const selectAt = (record: ObjectRecord, element: HTMLElement) => {
    const panel = panelRef.current;
    if (panel) {
      const chip = element.getBoundingClientRect();
      setTetherY(chip.top + chip.height / 2 - panel.getBoundingClientRect().top);
    }
    commands.select(record);
  };

  const closeCard = () => {
    commands.select(null);
    setTetherY(null);
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    commands.send(thread.id, body);
    setDraft('');
    // Answering the conversation that needed you visibly settles it.
    if (amber && !released) onReleased();
  };

  return (
    <section
      ref={panelRef}
      className="swb-panel"
      data-amber={amber && !released}
      data-released={released}
      aria-label={`Conversation with ${agent?.title ?? 'agent'}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return;
        // Escape peels one layer: the card first, then the panel, then the shell.
        if (selected) {
          closeCard();
          event.stopPropagation();
        } else if (onClose) {
          onClose();
          event.stopPropagation();
        }
      }}
    >
      <header className="swb-panel__head">
        <span className="swb-panel__monogram" aria-hidden>
          {(agent?.title ?? 'NK').slice(0, 2).toUpperCase()}
        </span>
        <div className="swb-panel__identity">
          <span className="swb-panel__name">{agent?.title ?? 'Conversation'}</span>
          <span className="swb-eyebrow">
            {field(agent, 'status') === 'live' ? 'live' : field(agent, 'status') || 'agent'}
          </span>
        </div>
        {mission && (
          <button
            type="button"
            className="swb-tie swb-tie--panel"
            onClick={(event) => selectAt(mission, event.currentTarget)}
          >
            <span className="swb-tie__line" aria-hidden />
            <span className="swb-tie__label">{mission.title}</span>
          </button>
        )}
        {onClose && (
          <button type="button" className="swb-panel__close" aria-label="Close conversation" onClick={onClose}>
            ✕
          </button>
        )}
      </header>

      <div className="swb-panel__body" ref={bodyRef}>
        {messages.length === 0 && (
          <p className="swb-panel__empty">Say something to start this conversation.</p>
        )}
        {messages.map((message) => {
          const mine = field(message, 'senderId') === 'principal_chris';
          const citations = graph.relatedBy(message.id, 'references');
          return (
            <div className="swb-turn" key={message.id} data-mine={mine}>
              <span className="swb-turn__meta">
                {mine ? 'You' : (agent?.title ?? 'Agent')} · {timeOf(field(message, 'createdAt'))}
              </span>
              <button
                type="button"
                className="swb-turn__bubble"
                data-selected={selected?.id === message.id}
                onClick={(event) => selectAt(message, event.currentTarget)}
              >
                {field(message, 'body')}
              </button>
              {citations.length > 0 && (
                <div className="swb-turn__chips">
                  {citations.map((record) => (
                    <ReferenceChip
                      key={record.id}
                      record={record}
                      selected={selected?.id === record.id}
                      onSelect={selectAt}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form
        className="swb-panel__composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          className="swb-panel__input"
          value={draft}
          rows={2}
          autoFocus
          placeholder={`Message ${agent?.title ?? 'the team'}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="swb-panel__send" disabled={!draft.trim()}>
          Send
        </button>
      </form>

      {selected && (
        <>
          {tetherY !== null && (
            <span className="swb-tether" style={{ top: `${tetherY}px` }} aria-hidden />
          )}
          <div
            className="swb-card-slot"
            style={tetherY !== null ? { top: `clamp(16px, ${tetherY - 24}px, 45%)` } : undefined}
          >
            <ContextCard
              record={selected}
              graph={graph}
              commands={commands}
              onAimAt={(record) => commands.select(record)}
              onClose={closeCard}
            />
          </div>
        </>
      )}
    </section>
  );
}
