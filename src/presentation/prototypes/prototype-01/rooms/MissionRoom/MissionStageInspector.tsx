import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../app/store';
import { KIND_LABEL, RELATION_LABEL, type ObjectRecord, type RelationType } from '../../object-graph/contract';
import { childStages, field } from '../../object-graph/graph';
import { roomFor } from '../../room-navigation/room-for';
import { summaryFor } from '../../components/InspectorPanel/inspector-content';
import './mission-stage-inspector.css';

function RelatedRow({ record }: { record: ObjectRecord }) {
  const { graph, select, enterRoom } = useStore();
  const [open, setOpen] = useState(false);
  const room = roomFor(record);
  const summary = summaryFor(record) || field(record, 'body') || field(record, 'result');

  return (
    <div className="mission-stage-related" data-open={open}>
      <button
        type="button"
        className="mission-stage-related__disclose"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">›</span>
        <span>
          <small>{KIND_LABEL[record.kind]}</small>
          <strong>{record.title}</strong>
        </span>
        {field(record, 'status') && <em>{field(record, 'status')}</em>}
      </button>
      {room && (
        <button
          type="button"
          className="mission-stage-related__open"
          aria-label={`Open ${record.title}`}
          title={`Open ${record.title}`}
          onClick={() => enterRoom(room)}
        >↗</button>
      )}
      {open && (
        <div className="mission-stage-related__preview">
          {summary && <p>{summary}</p>}
          <span>{graph.related(record.id).length} connected objects</span>
          <button type="button" onClick={() => select(record.id)}>Inspect this instead</button>
        </div>
      )}
    </div>
  );
}

/** Mission-owned contextual overlay. Selection discloses; only explicit actions navigate. */
export function MissionStageInspector({
  stageId,
  sequenceLabel,
  onReveal,
  onOpen,
}: {
  stageId: string;
  sequenceLabel: string;
  onReveal: () => void;
  onOpen: () => void;
}) {
  const { graph, select, revealed, elected } = useStore();
  const stage = graph.get(stageId);
  const [openSections, setOpenSections] = useState<ReadonlySet<RelationType>>(
    () => new Set<RelationType>(['contains']),
  );

  useEffect(() => {
    setOpenSections(new Set<RelationType>(['contains']));
  }, [stageId]);

  const children = childStages(graph, stageId);
  const sections = useMemo(
    () => (['belongsTo', 'contains', 'blockedBy'] as const)
      .map((relation) => ({ relation, records: graph.relatedBy(stageId, relation) }))
      .filter(({ records }) => records.length > 0),
    [graph, stageId],
  );

  if (!stage || stage.kind !== 'stage') return null;

  const status = field(stage, 'status') || 'planned';
  const condition = field(stage, 'condition');
  const isRevealed = revealed.includes(stageId);
  const isAttention = elected?.subject.id === stageId;

  return (
    <aside
      className="mission-stage-inspector"
      data-attention={isAttention}
      aria-label={`Stage inspector: ${stage.title}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="mission-stage-inspector__header">
        <div className="mission-stage-inspector__number">{sequenceLabel}</div>
        <div className="mission-stage-inspector__identity">
          <span>Stage · selected</span>
          <h2>{stage.title}</h2>
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Close Stage inspector">×</button>
      </header>

      <div className="mission-stage-inspector__body">
        <section className="mission-stage-inspector__brief">
          <div>
            <span>Status</span>
            <strong data-status={status}>{status}</strong>
          </div>
          <div>
            <span>Execution gate</span>
            <p>{condition || 'No completion condition recorded.'}</p>
          </div>
          <div>
            <span>Object</span>
            <code>{stage.id}</code>
          </div>
        </section>

        {sections.map(({ relation, records }) => {
          const open = openSections.has(relation);
          return (
            <section className="mission-stage-inspector__section" key={relation} data-open={open}>
              <button
                type="button"
                className="mission-stage-inspector__section-head"
                aria-expanded={open}
                onClick={() => setOpenSections((current) => {
                  const next = new Set(current);
                  if (next.has(relation)) next.delete(relation);
                  else next.add(relation);
                  return next;
                })}
              >
                <span>{RELATION_LABEL[relation] ?? relation}</span>
                <b>{records.length}</b>
                <i aria-hidden="true">⌄</i>
              </button>
              {open && (
                <div className="mission-stage-inspector__rows">
                  {records.slice(0, 8).map((record) => (
                    <RelatedRow key={`${relation}:${record.id}`} record={record} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="mission-stage-inspector__actions">
        {children.length > 0 && (
          <button type="button" className="mission-stage-inspector__reveal" onClick={onReveal}>
            <span>{isRevealed ? '−' : '+'}</span>
            {isRevealed ? 'Hide structure' : 'Show on canvas'}
            <em>{children.length}</em>
          </button>
        )}
        <button type="button" className="mission-stage-inspector__open" onClick={onOpen}>
          Open Stage <span>↗</span>
        </button>
      </footer>
    </aside>
  );
}
