import type { NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { BenchConversationCanvasNode } from '../model/bench-projection';
import { ConversationCard } from './ConversationCard';
import { DecisionRequestCallout } from './DecisionRequestCallout';
import { ConversationThread } from './ConversationThread';
import './conversation.css';

function materialStyleFor(threadId: string): CSSProperties {
  const signature = Array.from(threadId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return {
    '--bench-card-tilt': `${((signature % 5) - 2) * 0.28}deg`,
    '--bench-card-exposure': `${38 + (signature % 29)}%`,
  } as CSSProperties;
}

/** Keeps one canvas node identity while switching between card and open-thread views. */
export function ConversationNode({ data, selected }: NodeProps<BenchConversationCanvasNode>) {
  const pendingRequest = data.conversation.pendingDecisionRequests[0];
  return (
    <article
      className="bench-conversation"
      data-open={data.isOpen}
      data-focused={data.isFocused}
      data-tier={data.tier}
      data-selected={selected}
      data-blocked={data.conversation.isBlocked}
      data-mission-tone={data.conversation.mission?.tone ?? 'none'}
      style={materialStyleFor(data.conversation.thread.id)}
    >
      {data.conversation.mission && (
        <div className="bench-conversation__mission-pool" aria-hidden="true" />
      )}
      {data.isOpen ? (
        <ConversationThread
          conversation={data.conversation}
          missions={data.missions}
          savedScrollTop={data.savedScrollTop}
          actions={data.actions}
        />
      ) : (
        <ConversationCard conversation={data.conversation} tier={data.tier} actions={data.actions} />
      )}
      {pendingRequest && (
        <DecisionRequestCallout
          request={pendingRequest}
          requestCount={data.conversation.pendingDecisionRequests.length}
          actions={data.actions}
        />
      )}
    </article>
  );
}
