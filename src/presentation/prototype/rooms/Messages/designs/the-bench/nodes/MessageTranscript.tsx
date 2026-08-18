import { useLayoutEffect, useRef } from 'react';
import type { BenchMessage, BenchNodeActions } from '../model/bench-model';
import { MessageRecord } from './MessageRecord';

/** Scrollable transcript shared by the canvas thread and later Zen presentation. */
export function MessageTranscript({
  threadId,
  messages,
  composingAgentName,
  savedScrollTop,
  actions,
}: {
  threadId: string;
  messages: readonly BenchMessage[];
  composingAgentName: string | null;
  savedScrollTop: number;
  actions: BenchNodeActions;
}) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = savedScrollTop;
  }, [savedScrollTop, threadId]);

  return (
    <div
      ref={transcriptRef}
      className="bench-transcript nodrag nowheel"
      onScroll={(event) => actions.rememberTranscriptScroll(threadId, event.currentTarget.scrollTop)}
    >
      {messages.length > 0 ? messages.map((message) => (
        <MessageRecord key={message.record.id} threadId={threadId} message={message} actions={actions} />
      )) : (
        <p className="bench-transcript__empty">Nothing has been said yet. Start with the thing that matters.</p>
      )}

      {composingAgentName && (
        <p className="bench-transcript__composing" role="status">
          <span aria-hidden="true"><i /><i /><i /></span>
          {composingAgentName} is composing
        </p>
      )}
    </div>
  );
}
