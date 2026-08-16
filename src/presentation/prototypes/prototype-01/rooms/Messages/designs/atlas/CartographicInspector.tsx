import { forwardRef, useEffect, useState, type CSSProperties } from 'react';
import { KIND_LABEL, RELATION_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import { factsFor, relationsFor, summaryFor } from '../../../../components/InspectorPanel/inspector-content';

function RelatedSurvey({
  record,
  graph,
  onInspect,
  canOpen,
  onOpen,
}: {
  record: ObjectRecord;
  graph: ObjectGraph;
  onInspect: (id: string) => void;
  canOpen: (record: ObjectRecord) => boolean;
  onOpen: (record: ObjectRecord) => void;
}) {
  const [disclosed, setDisclosed] = useState(false);
  const summary =
    summaryFor(record) || field(record, 'claim') || field(record, 'question') || field(record, 'body');

  return (
    <div className="cartographic-inspector__relation" data-disclosed={disclosed}>
      <button
        type="button"
        className="cartographic-inspector__relation-row"
        aria-expanded={disclosed}
        onClick={() => setDisclosed((value) => !value)}
      >
        <span className="cartographic-inspector__relation-mark">{disclosed ? '−' : '+'}</span>
        <span>
          <small>{KIND_LABEL[record.kind]}</small>
          <strong>{record.title}</strong>
        </span>
        {field(record, 'status') && <em>{field(record, 'status')}</em>}
      </button>
      {disclosed && (
        <div className="cartographic-inspector__disclosure">
          {summary && <p>{summary}</p>}
          <span>{graph.related(record.id).length} connected objects</span>
          <div>
            <button type="button" onClick={() => onInspect(record.id)}>Inspect this</button>
            {canOpen(record) && <button type="button" onClick={() => onOpen(record)}>Open {KIND_LABEL[record.kind]} ↗</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export const CartographicInspector = forwardRef<
  HTMLDivElement,
  {
    graph: ObjectGraph;
    selected: ObjectRecord;
    trail: readonly ObjectRecord[];
    style: CSSProperties;
    onClose: () => void;
    onInspect: (id: string) => void;
    canOpen: (record: ObjectRecord) => boolean;
    onOpen: (record: ObjectRecord) => void;
    onTraverse: (threadId: string) => void;
    onFocus: (id: string) => void;
  }
>(function CartographicInspector(
  { graph, selected, trail, style, onClose, onInspect, canOpen, onOpen, onTraverse, onFocus },
  ref,
) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const summary = summaryFor(selected) || field(selected, 'body');
  const sections = relationsFor(selected.kind)
    .map((relation) => ({ relation, records: graph.relatedBy(selected.id, relation) }))
    .filter((section) => section.records.length > 0);
  const thread =
    selected.kind === 'thread'
      ? selected
      : graph.relatedOfKind(selected.id, 'belongsTo', 'thread')[0];

  return (
    <aside ref={ref} className="cartographic-inspector" style={style} aria-label="Atlas inspector">
      <div className="cartographic-inspector__leading-rule" />
      <header className="cartographic-inspector__header">
        <div>
          <span className="cartographic-inspector__coordinate">Selected / {KIND_LABEL[selected.kind]}</span>
          <h2>{selected.title}</h2>
          {summary && <p>{summary}</p>}
        </div>
        <button type="button" className="cartographic-inspector__close" onClick={onClose} aria-label="Close inspector">×</button>
      </header>

      {trail.length > 1 && (
        <nav className="cartographic-inspector__trail" aria-label="Inspection trail">
          {trail.slice(-4).map((record, index) => (
            <button type="button" key={`${record.id}:${index}`} onClick={() => onInspect(record.id)}>
              {record.title}
            </button>
          ))}
        </nav>
      )}

      <div className="cartographic-inspector__body">
        {factsFor(selected).length > 0 && (
          <section className="cartographic-inspector__facts">
            <h3>Survey notes</h3>
            {factsFor(selected).map((fact) => (
              <div key={fact.from}><span>{fact.label}</span><strong>{field(selected, fact.from)}</strong></div>
            ))}
            <div><span>Object id</span><code>{selected.id}</code></div>
          </section>
        )}
        {sections.map((section) => (
          <section className="cartographic-inspector__section" key={section.relation}>
            <h3>{RELATION_LABEL[section.relation] ?? section.relation}<span>{section.records.length}</span></h3>
            {section.records.slice(0, 7).map((record) => (
              <RelatedSurvey
                key={`${section.relation}:${record.id}`}
                record={record}
                graph={graph}
                onInspect={onInspect}
                canOpen={canOpen}
                onOpen={onOpen}
              />
            ))}
          </section>
        ))}
      </div>

      <footer className="cartographic-inspector__actions">
        {selected.kind === 'thread' && (
          <button type="button" className="cartographic-inspector__primary" onClick={() => onTraverse(selected.id)}>
            Traverse conversation <span>→</span>
          </button>
        )}
        {selected.kind === 'message' && (
          <button type="button" className="cartographic-inspector__primary" onClick={() => onFocus(selected.id)}>
            Focus landmark <span>⌖</span>
          </button>
        )}
        {selected.kind !== 'thread' && selected.kind !== 'message' && thread && (
          <button type="button" className="cartographic-inspector__quiet-action" onClick={() => onTraverse(thread.id)}>
            Traverse related conversation
          </button>
        )}
        {canOpen(selected) && (
          <button type="button" className="cartographic-inspector__open" onClick={() => onOpen(selected)}>
            Open {KIND_LABEL[selected.kind]} <span>↗</span>
          </button>
        )}
      </footer>
    </aside>
  );
});
