/**
 * The open conversation, floating above the floor.
 *
 * Anchored to the Room's visible area rather than to anything that scrolls, so it can
 * never be clipped by the field behind it. Nothing here truncates in silence: when the
 * transcript runs past the top edge it says how many turns are up there.
 */
import { useEffect, useRef, useState } from 'react';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignCommands } from '../../messages-design';
import { ContextCapsule } from './ContextCapsule';
import { initialsOf, roleOf } from './agent-labels';
import { agentOf, messagesOf, missionOf } from './orbit-model';

const PRINCIPAL_ID = 'principal_chris';

function clockOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

/** Mission and Agent: reveal here, open elsewhere. */
function AttachedRow({
  record,
  commands,
}: {
  record: ObjectRecord;
  commands: MessagesDesignCommands;
}) {
  return (
    <div className="gw-attached__row">
      <button type="button" className="gw-attached__body" onClick={() => commands.select(record)}>
        <span className="gw-attached__kind">{KIND_LABEL[record.kind]}</span>
        <span className="gw-attached__title">{record.title}</span>
      </button>
      {commands.canOpen(record) && (
        <button
          type="button"
          className="gw-attached__open"
          aria-label={`Open ${record.title}`}
          onClick={() => commands.open(record)}
        >
          ↗
        </button>
      )}
    </div>
  );
}

export function ReadingSurface({
  graph,
  thread,
  commands,
  selectedId,
  onSend,
  onClose,
}: {
  graph: ObjectGraph;
  thread: ObjectRecord;
  commands: MessagesDesignCommands;
  selectedId: string | null;
  onSend(threadId: string, body: string): void;
  onClose(): void;
}) {
  const [draft, setDraft] = useState('');
  const [turnsAbove, setTurnsAbove] = useState(0);
  const streamRef = useRef<HTMLDivElement>(null);

  const messages = messagesOf(graph, thread.id);
  const agent = agentOf(graph, thread);
  const mission = missionOf(graph, thread);
  const name = agent?.title ?? 'Conversation';

  const mentioned = [
    ...new Map(
      messages
        .flatMap((message) => graph.relatedBy(message.id, 'references'))
        .map((record) => [record.id, record]),
    ).values(),
  ];

  const measureTurnsAbove = () => {
    const stream = streamRef.current;
    if (!stream) return;
    let above = 0;
    for (const child of Array.from(stream.children)) {
      const turn = child as HTMLElement;
      if (turn.offsetTop + turn.offsetHeight < stream.scrollTop) above += 1;
    }
    setTurnsAbove(above);
  };

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.scrollTop = stream.scrollHeight;
    setTurnsAbove(0);
  }, [thread.id, messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(thread.id, body);
    setDraft('');
  };

  return (
    <aside className="gw-surface" aria-label={`Conversation with ${name}`}>
      <header className="gw-surface__head">
        <span className="gw-surface__avatar" data-live={field(agent ?? undefined, 'status') === 'live'}>
          {initialsOf(name)}
        </span>
        <span className="gw-surface__identity">
          <span className="gw-surface__eyebrow">{mission ? 'Mission thread' : 'Direct thread'}</span>
          <span className="gw-surface__name">{name}</span>
          <span className="gw-surface__role">{roleOf(graph, agent)}</span>
        </span>
        <button type="button" className="gw-surface__close" aria-label="Close conversation" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="gw-attached">
        {mission && <AttachedRow record={mission} commands={commands} />}
        {agent && <AttachedRow record={agent} commands={commands} />}
      </div>

      <div className="gw-surface__stream">
        {turnsAbove > 0 && (
          <button
            type="button"
            className="gw-surface__earlier"
            onClick={() => streamRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            {turnsAbove} earlier {turnsAbove === 1 ? 'turn' : 'turns'} ↑
          </button>
        )}
        <div className="gw-surface__scroll" ref={streamRef} onScroll={measureTurnsAbove}>
          {messages.length === 0 && (
            <p className="gw-surface__empty">Say something to open this conversation.</p>
          )}
          {messages.map((message) => {
            const mine = field(message, 'senderId') === PRINCIPAL_ID;
            const references = graph.relatedBy(message.id, 'references');
            return (
              <div className="gw-turn" key={message.id} data-mine={mine}>
                <span className="gw-turn__meta">
                  {mine ? 'You' : name} · {clockOf(field(message, 'createdAt'))}
                </span>
                <button
                  type="button"
                  className="gw-turn__body"
                  data-selected={selectedId === message.id}
                  onClick={() => commands.select(message)}
                >
                  {field(message, 'body')}
                </button>
                {references.map((record) => (
                  <ContextCapsule
                    key={record.id}
                    record={record}
                    commands={commands}
                    selected={selectedId === record.id}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <form
        className="gw-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          className="gw-composer__input"
          rows={2}
          value={draft}
          placeholder={`Message ${name}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="gw-composer__send" disabled={!draft.trim()}>
          Send
        </button>
      </form>

      {mentioned.length > 0 && (
        <div className="gw-mentions">
          <span className="gw-mentions__head">
            Mentioned <span className="gw-mentions__count">{mentioned.length}</span>
          </span>
          <div className="gw-mentions__list">
            {mentioned.map((record) => (
              <ContextCapsule
                key={record.id}
                record={record}
                commands={commands}
                selected={selectedId === record.id}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
