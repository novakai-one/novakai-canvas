import { useEffect, useState } from 'react';
import {
  KIND_LABEL,
  RELATION_LABEL,
  type ObjectRecord,
  type Related,
  type RelationType,
} from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';

type RelatedGroup = {
  relation: RelationType;
  records: readonly ObjectRecord[];
};

function summaryFor(record: ObjectRecord): string {
  const fields = ['body', 'question', 'claim', 'notes', 'blockedReason', 'result', 'description'];
  return fields.map((name) => field(record, name)).find(Boolean) ?? '';
}

function groupRelated(related: readonly Related[]): RelatedGroup[] {
  const groups = new Map<RelationType, ObjectRecord[]>();
  related.forEach(({ relation, record }) => {
    const records = groups.get(relation) ?? [];
    records.push(record);
    groups.set(relation, records);
  });
  return [...groups].map(([relation, records]) => ({ relation, records }));
}

function RelatedDisclosure({
  record,
  graph,
  commands,
}: {
  record: ObjectRecord;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
}) {
  const [disclosed, setDisclosed] = useState(false);
  const summary = summaryFor(record);

  return (
    <div className="signal-lens__related" data-disclosed={disclosed}>
      <button type="button" aria-expanded={disclosed} onClick={() => setDisclosed((value) => !value)}>
        <span>{disclosed ? '−' : '+'}</span>
        <span><small>{KIND_LABEL[record.kind]}</small><strong>{record.title}</strong></span>
        {field(record, 'status') && <em>{field(record, 'status')}</em>}
      </button>
      {disclosed && (
        <div className="signal-lens__disclosure">
          {summary && <p>{summary}</p>}
          <span>{graph.related(record.id).length} connected objects</span>
          <div>
            <button type="button" onClick={() => commands.select(record)}>Inspect</button>
            {commands.canOpen(record) && (
              <button type="button" onClick={() => commands.open(record)}>
                Open {KIND_LABEL[record.kind]} ↗
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InspectorFacts({ selected }: { selected: ObjectRecord }) {
  const timestamp = field(selected, 'createdAt') || selected.createdAt;
  const status = field(selected, 'status');
  return (
    <section className="signal-lens__facts">
      <h3>Signal coordinates</h3>
      {status && <div><span>Status</span><strong>{status}</strong></div>}
      {timestamp && <div><span>Recorded</span><strong>{timestamp}</strong></div>}
      <div><span>Object id</span><code>{selected.id}</code></div>
    </section>
  );
}

function InspectorRelations({
  groups,
  graph,
  commands,
}: {
  groups: readonly RelatedGroup[];
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
}) {
  return groups.map((group) => (
    <section className="signal-lens__relation-group" key={group.relation}>
      <h3>{RELATION_LABEL[group.relation] ?? group.relation}<span>{group.records.length}</span></h3>
      {group.records.slice(0, 7).map((record) => (
        <RelatedDisclosure key={`${group.relation}:${record.id}`} record={record} graph={graph} commands={commands} />
      ))}
    </section>
  ));
}

/** Shows selected object context in place and reserves navigation for explicit Open actions. */
export function SignalLensInspector({
  graph,
  selected,
  commands,
  onClose,
}: {
  graph: ObjectGraph;
  selected: ObjectRecord;
  commands: MessagesDesignCommands;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const summary = summaryFor(selected);
  const groups = groupRelated(graph.related(selected.id));

  return (
    <aside className="signal-lens" aria-label="Signal Lens inspector">
      <span className="signal-lens__leading-rule" aria-hidden="true" />
      <header>
        <div><span>Selected / {KIND_LABEL[selected.kind]}</span><h2>{selected.title}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close Signal Lens">×</button>
      </header>
      {summary && <p className="signal-lens__summary">{summary}</p>}
      <div className="signal-lens__body">
        <InspectorFacts selected={selected} />
        <InspectorRelations groups={groups} graph={graph} commands={commands} />
      </div>
      {commands.canOpen(selected) && (
        <footer>
          <button type="button" onClick={() => commands.open(selected)}>
            Open {KIND_LABEL[selected.kind]} <span>↗</span>
          </button>
        </footer>
      )}
    </aside>
  );
}
