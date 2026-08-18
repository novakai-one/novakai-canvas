import { useState } from 'react';
import type { BenchDecisionRequest, BenchNodeActions } from '../model/bench-model';
import { InlineDecisionForm } from '../nodes/InlineDecisionForm';

/** Zen-only blocker that delegates to the same authoritative Decision action. */
export function BlockedAgentBanner({
  request,
  requestCount,
  actions,
  onInspect,
}: {
  readonly request: BenchDecisionRequest;
  readonly requestCount: number;
  readonly actions: BenchNodeActions;
  readonly onInspect: () => void;
}) {
  const [isAnswering, setAnswering] = useState(false);
  return (
    <aside className="bench-blocked-banner" aria-label="Agent blocked by Decision Request">
      <div>
        <span>Blocked · {request.agentName}</span>
        <strong>{request.question}</strong>
        {requestCount > 1 && <small>{requestCount} pending requests</small>}
      </div>
      {isAnswering ? (
        <InlineDecisionForm
          requestId={`zen:${request.record.id}`}
          onSubmit={(ruling) => actions.answerDecisionRequest(request.context, ruling)}
          onCancel={() => setAnswering(false)}
        />
      ) : (
        <span className="bench-blocked-banner__actions">
          <button type="button" onClick={() => setAnswering(true)}>Answer</button>
          <button type="button" onClick={onInspect}>Inspect on Bench</button>
        </span>
      )}
    </aside>
  );
}
