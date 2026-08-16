/**
 * Contextual information for the selected object.
 *
 * The rule the whole application rests on lives here: this panel discloses and never
 * moves you. Clicking a related row expands its context inline. Moving to that object
 * takes a second, separately labelled action — and those two controls never look alike.
 */
import { useEffect, useState } from 'react';
import './inspector-panel.css';
import { useStore } from '../../app/store';
import {
  KIND_LABEL,
  RELATION_LABEL,
  type ObjectRecord,
  type RelationType,
} from '../../object-graph/contract';
import { field } from '../../object-graph/graph';
import { ActionButton, Eyebrow, Field, RoomAction, StateChip } from '../ui/ui';
import { factsFor, relationsFor, summaryFor } from './inspector-content';
import { roomFor } from '../../room-navigation/room-for';

/**
 * One related object.
 *
 * Two operations, deliberately different shapes: the row itself discloses a preview in
 * place, and the arrow button opens that object's Room. Neither is triggered by the
 * other, which is what stops a curious click from teleporting you.
 */
function RelatedObjectRow({ record }: { record: ObjectRecord }) {
  const { graph, enterRoom, select } = useStore();
  const [open, setOpen] = useState(false);
  const room = roomFor(record);
  const status = field(record, 'status');
  const preview = summaryFor(record) || field(record, 'result') || field(record, 'body');
  const connections = graph.related(record.id).length;

  return (
    <div className="related-row" data-open={open}>
      <button
        type="button"
        className="related-row__disclose"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="related-row__chevron" aria-hidden="true">
          ›
        </span>
        <span className="related-row__identity">
          <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
          <span className="related-row__title">{record.title}</span>
        </span>
        {status && <StateChip state={status} />}
      </button>

      {room && (
        <button
          type="button"
          className="related-row__open"
          title={`Open ${KIND_LABEL[room.kind === 'role' ? 'agentRoleProfile' : record.kind]}`}
          aria-label={`Open ${record.title}`}
          onClick={() => enterRoom(room)}
        >
          ↗
        </button>
      )}

      {open && (
        <div className="related-row__preview">
          {preview && <p className="related-row__preview-text">{preview}</p>}
          <div className="related-row__preview-meta">
            <span>{connections} connected {connections === 1 ? 'object' : 'objects'}</span>
            <ActionButton variant="ghost" onClick={() => select(record.id)}>
              Inspect this instead
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}

export function InspectorPanel({ hidden = false }: { hidden?: boolean }) {
  const { selected, graph, select, enterRoom, room, projection, patch, elected } = useStore();
  const [answered, setAnswered] = useState<string | null>(null);

  useEffect(() => {
    setAnswered(null);
  }, [selected?.id]);

  const missionWorldOwnsInspector =
    selected?.kind === 'stage' && room.kind === 'mission' && projection === 'world';

  if (!selected || missionWorldOwnsInspector || hidden) {
    return <aside className="inspector-panel" data-state="closed" aria-hidden="true" />;
  }

  const facts = factsFor(selected);
  const summary = summaryFor(selected);
  const target = roomFor(selected);
  const isElected = elected?.subject.id === selected.id;
  const alreadyHere = target !== null && room.kind === target.kind && 'subjectId' in room && room.subjectId === selected.id;

  const sections = relationsFor(selected.kind)
    .map((relation) => ({
      relation,
      records: graph.relatedBy(selected.id, relation),
    }))
    .filter((section) => section.records.length > 0);

  const options = Array.isArray(selected.fields.options) ? (selected.fields.options as string[]) : [];
  const pending = selected.kind === 'request' && field(selected, 'status') === 'pending';

  return (
    <aside className="inspector-panel" data-state="open" data-attention={isElected} aria-label="Inspector">
      <header className="inspector-panel__header">
        <div className="inspector-panel__identity">
          <Eyebrow kind={selected.kind} />
          <h2 className="inspector-panel__title">{selected.title}</h2>
          {summary && <p className="inspector-panel__summary">{summary}</p>}
        </div>
        <button
          type="button"
          className="inspector-panel__close"
          onClick={() => select(null)}
          aria-label="Close the inspector"
          title="Close the inspector"
        >
          ✕
        </button>
      </header>

      <div className="inspector-panel__body">
        {facts.length > 0 && (
          <section className="inspector-panel__section">
            <h3 className="inspector-panel__section-label">Identity</h3>
            {facts.map((fact) => (
              <Field key={fact.label} label={fact.label}>
                {fact.label === 'Status' ? (
                  <StateChip state={field(selected, fact.from)} />
                ) : (
                  field(selected, fact.from)
                )}
              </Field>
            ))}
            <Field label="Object id">
              <code className="inspector-panel__id">{selected.id}</code>
            </Field>
          </section>
        )}

        {pending && (
          <section className="inspector-panel__section">
            <h3 className="inspector-panel__section-label">
              Your answer
              <span className="inspector-panel__section-count">{options.length}</span>
            </h3>
            <div className="inspector-panel__options">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="inspector-panel__option"
                  data-chosen={answered === option}
                  onClick={() => {
                    setAnswered(option);
                    patch(selected.id, { status: 'answered', answer: option });
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        )}

        {sections.map((section) => (
          <section className="inspector-panel__section" key={section.relation}>
            <h3 className="inspector-panel__section-label">
              {RELATION_LABEL[section.relation as RelationType] ?? section.relation}
              <span className="inspector-panel__section-count">{section.records.length}</span>
            </h3>
            <div className="inspector-panel__rows">
              {section.records.slice(0, 8).map((record) => (
                <RelatedObjectRow key={record.id + section.relation} record={record} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="inspector-panel__actions">
        {target && !alreadyHere && (
          <RoomAction onClick={() => enterRoom(target)}>
            Open {KIND_LABEL[selected.kind]}
          </RoomAction>
        )}
      </footer>
    </aside>
  );
}
