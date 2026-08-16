import { forwardRef, useState } from 'react';
import {
  KIND_LABEL,
  RELATION_LABEL,
  type ObjectRecord,
  type RelationType,
} from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import {
  factsFor,
  relationsFor,
  summaryFor,
} from '../../../../components/InspectorPanel/inspector-content';
import type { MessagesDesignCommands } from '../../messages-design';
import type { CableLoad } from './catenary-model';
import { loadCurveDrop } from './catenary-geometry';

const READOUT_WIDTH = 236;
const READOUT_HEIGHT = 58;
const MAX_RELATED_PER_SECTION = 6;

function waitingText(load: CableLoad): string {
  if (load.hoursWaiting < 1) return 'minutes';
  if (load.hoursWaiting < 48) return `${Math.round(load.hoursWaiting)} hours`;
  return `${Math.round(load.hoursWaiting / 24)} days`;
}

/** Draws the same curve the cable is drawing, so the panel and the world agree. */
function TensionCurve({ load }: { load: CableLoad | null }) {
  const drop = Math.min(READOUT_HEIGHT - 12, loadCurveDrop(load) * 0.24);
  const path = `M 6 8 Q ${READOUT_WIDTH / 2} ${8 + drop * 2} ${READOUT_WIDTH - 6} 8`;
  return (
    <svg
      className="catenary-inspector__curve"
      viewBox={`0 0 ${READOUT_WIDTH} ${READOUT_HEIGHT}`}
      data-loaded={Boolean(load)}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function LoadSection({ load }: { load: CableLoad | null }) {
  return (
    <section className="catenary-inspector__section catenary-inspector__section--load">
      <h3>{load ? 'Under load' : 'Settled'}</h3>
      {load ? (
        <>
          <strong className="catenary-inspector__ask">{load.record.title}</strong>
          <span className="catenary-inspector__ask-meta">
            {KIND_LABEL[load.record.kind]}
            {field(load.record, 'status') && ` · ${field(load.record, 'status')}`}
            {` · waiting ${waitingText(load)}`}
          </span>
        </>
      ) : (
        <span className="catenary-inspector__ask-meta">Nothing outstanding on this cable.</span>
      )}
      <TensionCurve load={load} />
    </section>
  );
}

function IdentitySection({ record }: { record: ObjectRecord }) {
  const facts = factsFor(record);
  if (facts.length === 0) return null;
  return (
    <section className="catenary-inspector__section">
      <h3>Identity</h3>
      {facts.map((fact) => (
        <div className="catenary-inspector__fact" key={fact.from}>
          <span>{fact.label}</span>
          <strong>{field(record, fact.from)}</strong>
        </div>
      ))}
      <div className="catenary-inspector__fact">
        <span>Object id</span>
        <code>{record.id}</code>
      </div>
    </section>
  );
}

function RelatedRow({
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
  const summary = summaryFor(record) || field(record, 'result') || field(record, 'body');

  return (
    <div className="catenary-inspector__related" data-disclosed={disclosed}>
      <button
        type="button"
        className="catenary-inspector__related-row"
        aria-expanded={disclosed}
        onClick={() => setDisclosed((current) => !current)}
      >
        <span aria-hidden="true">{disclosed ? '−' : '+'}</span>
        <span>
          <small>{KIND_LABEL[record.kind]}</small>
          <strong>{record.title}</strong>
        </span>
      </button>
      {disclosed && (
        <div className="catenary-inspector__related-context">
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

function AttachedSections({
  record,
  graph,
  commands,
  onInspect,
}: {
  record: ObjectRecord;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  onInspect: (related: ObjectRecord) => void;
}) {
  const sections = relationsFor(record.kind)
    .map((relation) => ({ relation, records: graph.relatedBy(record.id, relation) }))
    .filter((section) => section.records.length > 0);

  return sections.map((section) => (
    <section className="catenary-inspector__section" key={section.relation}>
      <h3>
        {RELATION_LABEL[section.relation as RelationType] ?? section.relation}
        <span>{section.records.length}</span>
      </h3>
      {section.records.slice(0, MAX_RELATED_PER_SECTION).map((related) => (
        <RelatedRow
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

/**
 * The Load panel: what this turn opened, before what it is related to.
 *
 * It discloses context in place and never navigates on its own — the explicit Open
 * action at the foot is the only way out of the Room.
 */
export const LoadInspector = forwardRef<
  HTMLElement,
  {
    selected: ObjectRecord;
    graph: ObjectGraph;
    load: CableLoad | null;
    commands: MessagesDesignCommands;
    onClose: () => void;
    onInspect: (record: ObjectRecord) => void;
  }
>(function LoadInspector({ selected, graph, load, commands, onClose, onInspect }, ref) {
  const summary = summaryFor(selected);

  return (
    <aside ref={ref} className="catenary-inspector" aria-label="Catenary load inspector">
      <header className="catenary-inspector__header">
        <div>
          <span>{KIND_LABEL[selected.kind]}</span>
          <h2>{summary || selected.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close inspector">×</button>
      </header>
      <div className="catenary-inspector__body">
        <LoadSection load={load} />
        <IdentitySection record={selected} />
        <AttachedSections
          record={selected}
          graph={graph}
          commands={commands}
          onInspect={onInspect}
        />
      </div>
      {commands.canOpen(selected) && (
        <footer className="catenary-inspector__footer">
          <button type="button" onClick={() => commands.open(selected)}>
            Open {KIND_LABEL[selected.kind]} ↗
          </button>
        </footer>
      )}
    </aside>
  );
});
