import type { ObjectRecord } from '../../../../../object-graph/contract';
import type { BenchConversation, BenchNodeActions } from '../model/bench-model';
import { ConversationThread } from '../nodes/ConversationThread';

/** Focused presentation of the existing conversation implementation. */
export function ZenLayer({
  conversation,
  savedScrollTop,
  missions,
  actions,
  onExit,
}: {
  conversation: BenchConversation;
  savedScrollTop: number;
  missions: readonly ObjectRecord[];
  actions: BenchNodeActions;
  onExit(): void;
}) {
  return (
    <section className="bench-zen" aria-label={`Focused conversation with ${conversation.primaryParticipant?.record.title ?? 'agent'}`}>
      <button type="button" className="bench-zen__exit" onClick={onExit}>Exit focus <kbd>Esc</kbd></button>
      <div className="bench-zen__thread">
        <ConversationThread
          conversation={conversation}
          missions={missions}
          savedScrollTop={savedScrollTop}
          actions={actions}
        />
      </div>
    </section>
  );
}
