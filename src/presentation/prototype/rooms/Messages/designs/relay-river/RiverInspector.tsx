import { forwardRef, useState } from 'react';
import {
  KIND_LABEL,
  RELATION_LABEL,
  type ObjectRecord,
  type RelationType,
} from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import { factsFor, relationsFor, summaryFor } from '../../../../components/InspectorPanel/inspector-content';
import { StateChip } from '../../../../components/ui/ui';
import type { MessagesDesignCommands } from '../../messages-design';

function RelatedRecord({
  record,
  graph,
  commands,
  onInspect,
}: {
  record: ObjectRecord;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  onInspect: (record: ObjectRecord) => void;
}) {
  const [disclosed, setDisclosed] = useState(false);
  const summary = summaryFor(record)
    || field(record, 'result')
    || field(record, 'body');
  return (
    <div className="river-inspector__relation" data-disclosed={disclosed}>
      <button
        type="button"
        className="river-inspector__relation-row"
        aria-expanded={disclosed}
        onClick={() => setDisclosed((current) => !current)}
      >
        <span aria-hidden="true">{disclosed ? '−' : '+'}</span>
        <span><small>{KIND_LABEL[record.kind]}</small><strong>{record.title}</strong></span>
        {field(record, 'status') && <StateChip state={field(record, 'status')} />}
      </button>
      {disclosed && (
        <div className="river-inspector__relation-context">
          {summary && <p>{summary}</p>}
          <small>{graph.related(record.id).length} connected objects</small>
          <div>
            <button type="button" onClick={() => onInspect(record)}>Inspect this</button>
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

function IdentityFacts({ record }: { record: ObjectRecord }) {
  const facts = factsFor(record);
  if (facts.length === 0) return null;
  return (
    <section className="river-inspector__section">
      <h3>Identity</h3>
      {facts.map((fact) => (
        <div className="river-inspector__fact" key={fact.from}>
          <span>{fact.label}</span>
          <strong>{field(record, fact.from)}</strong>
        </div>
      ))}
      <div className="river-inspector__fact">
        <span>Object id</span><code>{record.id}</code>
      </div>
    </section>
  );
}

function RelationSections({
  record,
  graph,
  commands,
  onInspect,
}: {
  record: ObjectRecord;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  onInspect: (record: ObjectRecord) => void;
}) {
  const sections = relationsFor(record.kind)
    .map((relation) => ({ relation, records: graph.relatedBy(record.id, relation) }))
    .filter((section) => section.records.length > 0);
  return sections.map((section) => (
    <section className="river-inspector__section" key={section.relation}>
      <h3>
        {RELATION_LABEL[section.relation as RelationType] ?? section.relation}
        <span>{section.records.length}</span>
      </h3>
      {section.records.slice(0, 8).map((related) => (
        <RelatedRecord
          key={`${section.relation}:${related.id}`}
          record={related}
          graph={graph}
          commands={commands}
          onInspect={onInspect}
        />
      ))}
    </section>
  ));
}

/** A Room-local inspector that discloses context without navigating. */
export const RiverInspector = forwardRef<
  HTMLElement,
  {
    graph: ObjectGraph;
    selected: ObjectRecord;
    commands: MessagesDesignCommands;
    onClose: () => void;
    onInspect: (record: ObjectRecord) => void;
  }
>(function RiverInspector({ graph, selected, commands, onClose, onInspect }, ref) {
  const summary = summaryFor(selected);
  return (
    <aside ref={ref} className="river-inspector" aria-label="Relay River inspector">
      <header className="river-inspector__header">
        <div>
          <span>{KIND_LABEL[selected.kind]} · selected source</span>
          <h2>{selected.title}</h2>
          {summary && <p>{summary}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close inspector">×</button>
      </header>
      <div className="river-inspector__body">
        <IdentityFacts record={selected} />
        <RelationSections
          record={selected}
          graph={graph}
          commands={commands}
          onInspect={onInspect}
        />
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
});
