import { useState } from 'react';
import type { BenchDecisionRequest, BenchNodeActions } from '../model/bench-model';
import { InlineDecisionForm } from './InlineDecisionForm';

/** Restrained normal-mode lift-out for the first pending Decision Request. */
export function DecisionRequestCallout({
  request,
  requestCount,
  actions,
}: {
  readonly request: BenchDecisionRequest;
  readonly requestCount: number;
  readonly actions: BenchNodeActions;
}) {
  const [isAnswering, setAnswering] = useState(false);
  const inspect = () => {
    actions.openConversation(request.context.threadId);
    actions.expandMessageRelation(
      request.context.threadId,
      request.context.rootMessageId,
      request.context.requestRelation,
      request.context.requestId,
    );
  };

  return (
    <aside className="bench-decision-callout nodrag" aria-label="Pending Decision Request">
      <header>
        <span>Decision needed</span>
        {requestCount > 1 && <small>{requestCount} pending</small>}
      </header>
      <strong>{request.agentName}</strong>
      <p>{request.question}</p>
      {isAnswering ? (
        <InlineDecisionForm
          requestId={request.record.id}
          onSubmit={(ruling) => actions.answerDecisionRequest(request.context, ruling)}
          onCancel={() => setAnswering(false)}
        />
      ) : (
        <footer>
          <button type="button" onClick={() => setAnswering(true)}>Answer</button>
          <button type="button" onClick={inspect}>Inspect</button>
        </footer>
      )}
    </aside>
  );
}
