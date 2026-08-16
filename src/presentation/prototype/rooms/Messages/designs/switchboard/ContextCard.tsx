/**
 * The disclosure card: a selected object explains itself before anything navigates.
 *
 * Docked anatomy — kind eyebrow, title, status, claim, then its nearest relations as
 * quiet rows. Clicking a relation re-aims the card at that object (context first,
 * again); the explicit `Open` control at the foot is the only way anything navigates.
 */
import { field } from '../../../../object-graph/graph';
import type { ObjectGraph } from '../../../../object-graph/graph';
import {
  KIND_LABEL,
  RELATION_LABEL,
  type ObjectRecord,
  type Related,
} from '../../../../object-graph/contract';
import type { MessagesDesignCommands } from '../../messages-design';

/** Relations worth a row on a small card, in the order a reader wants them. */
const RELATION_ORDER: readonly Related['relation'][] = [
  'belongsTo',
  'assignedTo',
  'resolvedBy',
  'blockedBy',
  'attemptedBy',
  'pursuedBy',
  'produces',
  'producedBy',
  'cites',
];

function nearestRelations(graph: ObjectGraph, record: ObjectRecord): Related[] {
  const seen = new Set<string>();
  return graph
    .related(record.id)
    .filter((entry) => RELATION_ORDER.includes(entry.relation))
    .filter((entry) => entry.record.kind !== 'message' && entry.record.kind !== 'notification')
    .filter((entry) => (seen.has(entry.record.id) ? false : seen.add(entry.record.id)))
    .sort(
      (a, b) => RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation),
    )
    .slice(0, 4);
}

export function ContextCard({
  record,
  graph,
  commands,
  onAimAt,
  onClose,
}: {
  record: ObjectRecord;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  /** Re-aim the card at a related object without moving the user. */
  onAimAt: (record: ObjectRecord) => void;
  onClose: () => void;
}) {
  const status = field(record, 'status');
  const claim =
    field(record, 'claim') ||
    field(record, 'question') ||
    field(record, 'blockedReason') ||
    field(record, 'body');

  return (
    <div className="swb-card" role="dialog" aria-label={`${KIND_LABEL[record.kind]} context`}>
      <header className="swb-card__head">
        <div>
          <span className="swb-eyebrow">{KIND_LABEL[record.kind]}</span>
          <h3 className="swb-card__title">{record.title}</h3>
        </div>
        <button type="button" className="swb-card__close" aria-label="Close context" onClick={onClose}>
          ✕
        </button>
      </header>

      {status && (
        <p className="swb-card__status" data-state={status}>
          <span aria-hidden>◆</span> {status}
        </p>
      )}
      {claim && <p className="swb-card__claim">{claim}</p>}

      {nearestRelations(graph, record).map((entry) => (
        <button
          key={entry.record.id}
          type="button"
          className="swb-card__relation"
          onClick={() => onAimAt(entry.record)}
        >
          <span className="swb-eyebrow">
            {RELATION_LABEL[entry.relation] ?? 'Related'} · {KIND_LABEL[entry.record.kind]}
          </span>
          <span className="swb-card__relation-title">{entry.record.title}</span>
        </button>
      ))}

      {commands.canOpen(record) && (
        <button type="button" className="swb-card__open" onClick={() => commands.open(record)}>
          Open {KIND_LABEL[record.kind]} ↗
        </button>
      )}
    </div>
  );
}
