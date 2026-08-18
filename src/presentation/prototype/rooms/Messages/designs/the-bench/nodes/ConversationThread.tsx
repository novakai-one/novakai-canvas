import type { ObjectRecord } from '../../../../../object-graph/contract';
import type { BenchConversation, BenchNodeActions } from '../model/bench-model';
import { ConversationMenu } from './ConversationMenu';
import { MessageComposer } from './MessageComposer';
import { MessageTranscript } from './MessageTranscript';

/** Full thread that expands in the stable conversation node without moving it. */
export function ConversationThread({
  conversation,
  missions,
  savedScrollTop,
  actions,
}: {
  conversation: BenchConversation;
  missions: readonly ObjectRecord[];
  savedScrollTop: number;
  actions: BenchNodeActions;
}) {
  const participant = conversation.primaryParticipant;
  const agentName = participant?.record.title ?? 'Unassigned agent';

  return (
    <section className="bench-thread">
      <header className="bench-thread__header">
        <span className="bench-thread__avatar" data-status={participant?.status ?? 'unknown'}>
          {participant?.initials ?? '—'}
        </span>
        <span className="bench-thread__identity">
          {conversation.mission && (
            <span className="bench-thread__eyebrow">{conversation.mission.record.title}</span>
          )}
          <strong>{agentName}</strong>
        </span>
        <ConversationMenu conversation={conversation} missions={missions} actions={actions} />
        <button
          type="button"
          className="bench-thread__collapse nodrag"
          onClick={() => actions.collapseConversation(conversation.thread.id)}
          aria-label={`Collapse conversation with ${agentName}`}
          title="Collapse conversation"
        >
          ‹
        </button>
      </header>

      <MessageTranscript
        threadId={conversation.thread.id}
        messages={conversation.messages}
        composingAgentName={conversation.composingAgentName}
        savedScrollTop={savedScrollTop}
        actions={actions}
      />
      <MessageComposer threadId={conversation.thread.id} actions={actions} />
    </section>
  );
}
