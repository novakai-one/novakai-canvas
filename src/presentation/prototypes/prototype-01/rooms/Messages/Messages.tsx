/**
 * Conversations, kept attached to the work they belong to.
 *
 * A referenced object inside a message discloses its context in place first; opening it
 * is a separate control. That is the same rule as the inspector, applied to prose.
 */
import { useState } from 'react';
import './messages.css';
import { makeRecord, sessionId, useStore } from '../../app/store';
import { field } from '../../object-graph/graph';
import { KIND_LABEL, type ObjectRecord } from '../../object-graph/contract';
import { ActionButton, EmptyState, StateChip } from '../../components/ui/ui';
import { roomFor } from '../../room-navigation/room-for';

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function timeOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toISOString().slice(11, 16);
}

/** A referenced object inside a message: disclose here, open elsewhere. */
function MessageReference({ record }: { record: ObjectRecord }) {
  const { enterRoom, select } = useStore();
  const [open, setOpen] = useState(false);
  const room = roomFor(record);
  const preview =
    field(record, 'claim') || field(record, 'question') || field(record, 'blockedReason') || field(record, 'body');

  return (
    <div className="message-reference" data-open={open}>
      <button type="button" className="message-reference__chip" onClick={() => setOpen((v) => !v)}>
        <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
        {record.title}
      </button>
      {open && (
        <div className="message-reference__preview">
          {preview && <p>{preview}</p>}
          <div className="message-reference__actions">
            <ActionButton variant="ghost" onClick={() => select(record.id)}>
              Inspect
            </ActionButton>
            {room && (
              <ActionButton variant="ghost" onClick={() => enterRoom(room)}>
                Open {KIND_LABEL[record.kind]} ↗
              </ActionButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Messages({ threadId }: { threadId?: string }) {
  const { graph, select, selected, addRecord, enterRoom, patch } = useStore();
  const threads = graph.byKind('thread');
  const [activeId, setActiveId] = useState<string>(threadId ?? threads[0]?.id ?? '');
  const [draft, setDraft] = useState('');
  const [startingNew, setStartingNew] = useState(false);

  const active = graph.get(threadId ?? activeId);
  const agents = graph.byKind('agent').filter((a) => field(a, 'status') === 'live');

  const messagesOf = (thread: ObjectRecord) =>
    graph
      .relatedOfKind(thread.id, 'contains', 'message')
      .slice()
      .sort((a, b) => (field(a, 'createdAt') < field(b, 'createdAt') ? -1 : 1));

  const send = () => {
    if (!active || !draft.trim()) return;
    const id = sessionId('msg', draft.slice(0, 20));
    addRecord(
      makeRecord(id, 'message', draft.trim(), {
        messageId: id,
        threadId: active.id,
        senderId: 'principal_chris',
        body: draft.trim(),
        createdAt: new Date().toISOString(),
      }),
    );
    // Replying clears the unread marker on this conversation.
    const notification = graph
      .byKind('notification')
      .find((n) => (n.fields.subjectRef as { id?: string })?.id === active.id);
    if (notification) patch(notification.id, { status: 'read' });
    setDraft('');
  };

  const startWith = (agent: ObjectRecord) => {
    const mission = graph.relatedBy(agent.id, 'belongsTo').find((r) => r.kind === 'mission');
    const id = sessionId('thread', agent.title);
    addRecord(
      makeRecord(
        id,
        'thread',
        `Conversation with ${agent.title}`,
        { roomId: mission?.id ?? '', ts: new Date().toISOString() },
        [
          ...(mission ? [{ kind: 'mission', value: mission.id }] : []),
          { kind: 'agent', value: agent.id },
        ],
      ),
    );
    setActiveId(id);
    setStartingNew(false);
  };

  const agentOf = (thread: ObjectRecord) =>
    graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'agent');
  const missionOf = (thread: ObjectRecord) =>
    graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'mission');

  const unread = (thread: ObjectRecord) =>
    graph
      .byKind('notification')
      .some(
        (n) =>
          (n.fields.subjectRef as { id?: string })?.id === thread.id && field(n, 'status') === 'unread',
      );

  return (
    <div className="messages">
      {!threadId && (
        <aside className="messages__list" aria-label="Conversations">
          <div className="messages__list-head">
            <span className="eyebrow">Conversations</span>
            <button
              type="button"
              className="messages__new"
              onClick={() => setStartingNew((v) => !v)}
              title="Start a conversation with an agent"
            >
              {startingNew ? '✕' : '+'}
            </button>
          </div>

          {startingNew && (
            <div className="messages__picker">
              <p className="messages__picker-label">Who do you want to talk to?</p>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="messages__picker-option"
                  onClick={() => startWith(agent)}
                >
                  <span className="messages__avatar">{initials(agent.title)}</span>
                  <span>
                    {agent.title}
                    <span className="messages__picker-role">
                      {graph.relatedBy(agent.id, 'occupies')[0]
                        ? graph.relatedBy(
                            graph.relatedBy(agent.id, 'occupies')[0].id,
                            'requests',
                          )[0]?.title
                        : 'Unseated'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="messages__threads">
            {threads.map((thread) => {
              const agent = agentOf(thread);
              const mission = missionOf(thread);
              const last = messagesOf(thread).at(-1);
              return (
                <button
                  key={thread.id}
                  type="button"
                  className="messages__thread"
                  data-current={active?.id === thread.id}
                  data-unread={unread(thread)}
                  onClick={() => setActiveId(thread.id)}
                >
                  <span className="messages__avatar">{initials(agent?.title ?? 'NK')}</span>
                  <span className="messages__thread-text">
                    <span className="messages__thread-name">{agent?.title ?? 'Conversation'}</span>
                    <span className="messages__thread-mission">{mission?.title ?? 'No mission'}</span>
                    <span className="messages__thread-last">{last?.title ?? 'No messages yet'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {active ? (
        <>
          <section className="messages__stream" aria-label="Conversation">
            <header className="messages__stream-head">
              <span className="messages__avatar messages__avatar--large">
                {initials(agentOf(active)?.title ?? 'NK')}
              </span>
              <span className="messages__stream-identity">
                <span className="eyebrow">Agent</span>
                <span className="messages__stream-name">{agentOf(active)?.title ?? 'Conversation'}</span>
              </span>
              {agentOf(active) && <StateChip state={field(agentOf(active)!, 'status')} />}
            </header>

            <div className="messages__body">
              {messagesOf(active).length === 0 && (
                <EmptyState>Say something to start this conversation.</EmptyState>
              )}
              {messagesOf(active).map((message) => {
                const mine = field(message, 'senderId') === 'principal_chris';
                const references = graph.relatedBy(message.id, 'references');
                return (
                  <div className="messages__bubble-row" key={message.id} data-mine={mine}>
                    <span className="messages__bubble-meta">
                      {mine ? 'You' : agentOf(active)?.title} · {timeOf(field(message, 'createdAt'))}
                    </span>
                    <button
                      type="button"
                      className="messages__bubble"
                      data-selected={selected?.id === message.id}
                      onClick={() => select(message.id)}
                    >
                      {field(message, 'body')}
                    </button>
                    {references.length > 0 && (
                      <div className="messages__references">
                        {references.map((record) => (
                          <MessageReference key={record.id} record={record} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form
              className="messages__composer"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <textarea
                className="messages__composer-input"
                value={draft}
                rows={2}
                placeholder={`Message ${agentOf(active)?.title ?? 'the team'}`}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <ActionButton variant="primary" onClick={send} disabled={!draft.trim()}>
                Send
              </ActionButton>
            </form>
          </section>

          <aside className="messages__context" aria-label="Conversation context">
            <span className="eyebrow">Attached to</span>
            {[missionOf(active), agentOf(active)].filter(Boolean).map((record) => {
              const room = roomFor(record!);
              return (
                <div className="messages__context-row" key={record!.id}>
                  <button
                    type="button"
                    className="messages__context-body"
                    onClick={() => select(record!.id)}
                  >
                    <span className="eyebrow">{KIND_LABEL[record!.kind]}</span>
                    <span className="messages__context-title">{record!.title}</span>
                  </button>
                  {room && (
                    <button
                      type="button"
                      className="messages__context-open"
                      title={`Open ${KIND_LABEL[record!.kind]}`}
                      aria-label={`Open ${record!.title}`}
                      onClick={() => enterRoom(room)}
                    >
                      ↗
                    </button>
                  )}
                </div>
              );
            })}

            <span className="eyebrow messages__context-heading">Mentioned in this thread</span>
            {Array.from(
              new Map(
                messagesOf(active)
                  .flatMap((message) => graph.relatedBy(message.id, 'references'))
                  .map((record) => [record.id, record]),
              ).values(),
            ).map((record) => (
              <div className="messages__context-row" key={record.id}>
                <button
                  type="button"
                  className="messages__context-body"
                  onClick={() => select(record.id)}
                >
                  <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
                  <span className="messages__context-title">{record.title}</span>
                </button>
              </div>
            ))}
          </aside>
        </>
      ) : (
        <div className="messages__stream">
          <EmptyState>Pick a conversation, or start a new one with an agent.</EmptyState>
        </div>
      )}
    </div>
  );
}
