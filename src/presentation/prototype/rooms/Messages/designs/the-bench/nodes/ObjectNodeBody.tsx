import { factsFor, summaryFor } from '../../../../../components/InspectorPanel/inspector-content';
import { KIND_LABEL } from '../../../../../object-graph/contract';
import { field } from '../../../../../object-graph/graph';
import type { ObjectRecord } from '../../../../../object-graph/contract';
import type { BenchNodeActions } from '../model/bench-model';

/** Shared object identity, facts, summary, and guarded travel action. */
export function ObjectNodeBody({
  record,
  actions,
}: {
  record: ObjectRecord;
  actions: BenchNodeActions;
}) {
  const summary = summaryFor(record) || field(record, 'body') || field(record, 'result');
  const facts = factsFor(record);
  const canTravel = actions.canTravel(record.id);

  return (
    <div className="bench-object-body" onClick={() => actions.selectRecord(record.id)}>
      <span className="bench-object-body__kind">{KIND_LABEL[record.kind]}</span>
      <strong>{record.title}</strong>
      <code>{record.id}</code>
      {summary && <p>{summary}</p>}
      {facts.length > 0 && (
        <dl>
          {facts.map((fact) => (
            <div key={fact.from}>
              <dt>{fact.label}</dt>
              <dd>{field(record, fact.from)}</dd>
            </div>
          ))}
        </dl>
      )}
      {canTravel && (
        <button
          type="button"
          className="bench-object-body__travel nodrag"
          onClick={(event) => {
            event.stopPropagation();
            actions.travel(record.id);
          }}
          aria-label={`Open ${record.title}`}
        >
          Open <span aria-hidden="true">↗</span>
        </button>
      )}
    </div>
  );
}
