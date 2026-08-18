import { Handle, Position } from '@xyflow/react';
import { KIND_LABEL } from '../../../../../object-graph/contract';
import type { BenchMessage, BenchNodeActions } from '../model/bench-model';

function readableTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

/** One selectable message record with relation chips and an exact inspection handle. */
export function MessageRecord({
  threadId,
  message,
  actions,
}: {
  threadId: string;
  message: BenchMessage;
  actions: BenchNodeActions;
}) {
  return (
    <article
      className="bench-message"
      data-mine={message.isMine}
      onClick={() => actions.selectRecord(message.record.id)}
    >
      <header className="bench-message__meta">
        <strong>{message.isMine ? 'Chris' : message.senderName}</strong>
        <time dateTime={message.createdAt}>{readableTime(message.createdAt)}</time>
        <code>{message.record.id}</code>
      </header>
      <p>{message.body}</p>

      {message.relations.length > 0 && (
        <footer className="bench-message__relations">
          <span className="bench-message__chips">
            {message.relations.slice(0, 3).map((relation) => (
              <span key={`${relation.relation}:${relation.record.id}`}>
                {KIND_LABEL[relation.record.kind]} · {relation.record.title}
              </span>
            ))}
          </span>
          <button
            type="button"
            className="bench-message__inspect nodrag"
            onClick={(event) => {
              event.stopPropagation();
              actions.inspectMessage(threadId, message.record.id);
            }}
          >
            Inspect
          </button>
        </footer>
      )}

      <Handle
        id={`message:${message.record.id}:inspect`}
        className="bench-message__source"
        type="source"
        position={Position.Right}
      />
    </article>
  );
}
