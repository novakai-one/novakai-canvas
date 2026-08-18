import type { NodeProps } from '@xyflow/react';
import type { BenchConversationCanvasNode } from '../model/bench-projection';
import { ConversationCard } from './ConversationCard';
import { ConversationThread } from './ConversationThread';
import './conversation.css';

/** Keeps one canvas node identity while switching between card and open-thread views. */
export function ConversationNode({ data, selected }: NodeProps<BenchConversationCanvasNode>) {
  return (
    <article
      className="bench-conversation"
      data-open={data.isOpen}
      data-focused={data.isFocused}
      data-tier={data.tier}
      data-selected={selected}
      data-blocked={data.conversation.isBlocked}
      data-mission-tone={data.conversation.mission?.tone ?? 'none'}
    >
      <div className="bench-conversation__mission-pool" aria-hidden="true" />
      {data.isOpen ? (
        <ConversationThread
          conversation={data.conversation}
          savedScrollTop={data.savedScrollTop}
          actions={data.actions}
        />
      ) : (
        <ConversationCard conversation={data.conversation} tier={data.tier} actions={data.actions} />
      )}
    </article>
  );
}
