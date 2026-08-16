/**
 * The Trace Reader: what one moment on the clock actually contains.
 *
 * Everything here discloses in place. A referenced object expands inside its own row to
 * show what it is and what it touches, and the only way to leave the Room is the explicit
 * Open action on that row. Selecting never navigates.
 *
 * The Context section names the Agent and, when the conversation genuinely has one, the
 * Mission. A conversation without a Mission renders no Mission row and no substitute for
 * one — the section is simply shorter.
 */
import { useEffect, useState, type RefObject } from 'react';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { factsFor, relationsFor, summaryFor } from '../../../../components/InspectorPanel/inspector-content';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import type { WaveTrace } from './standing-wave-model';

const MAX_RELATED_ROWS = 6;

/**
 * Escape closes the reader.
 *
 * Clicking the canvas already closes it through the canvas's own pane handler, so there
 * is deliberately no global outside-click listener here: one would also fire on the
 * composer and the legend, and reading a reference while writing a reply is a pairing the
 * Room should support rather than punish.
 */
function useDismissOnEscape(onDismiss: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);
}

function momentLabel(record: ObjectRecord): string {
  const parsed = new Date(field(record, 'createdAt') || record.createdAt);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().replace('T', ' ').slice(0, 16);
}

/** Where this moment sits between the conversation's first and last message, 0 to 1. */
function progressThroughTrace(trace: WaveTrace, record: ObjectRecord): number | null {
  const first = trace.messages[0];
  const last = trace.messages.at(-1);
  if (!first || !last) return null;
  const start = Date.parse(first.time);
  const end = Date.parse(last.time);
  const moment = Date.parse(field(record, 'createdAt') || record.createdAt);
  if (!Number.isFinite(moment) || end <= start) return null;
  return Math.min(1, Math.max(0, (moment - start) / (end - start)));
}

/**
 * The panel's own miniature of the lane behind it.
 *
 * Without it the reader is a generic detail pane; with it, the panel says which part of
 * the conversation you are standing in, in the same left-to-right grammar as the canvas.
 */
function TraceReaderClock({ trace, record }: { trace: WaveTrace; record: ObjectRecord }) {
  const progress = progressThroughTrace(trace, record);
  if (progress === null) return null;

  return (
    <div className="trace-reader__clock">
      <span className="trace-reader__clock-edge">{trace.messages[0]?.time.slice(11, 16)}</span>
      <span className="trace-reader__clock-track">
        {trace.messages.map((message) => (
          <i
            key={message.record.id}
            className="trace-reader__clock-tick"
            data-current={message.record.id === record.id}
            style={{ left: `${(progressThroughTrace(trace, message.record) ?? 0) * 100}%` }}
          />
        ))}
      </span>
      <span className="trace-reader__clock-edge">Now</span>
    </div>
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
  const summary = summaryFor(record) || field(record, 'body') || field(record, 'result');
  const status = field(record, 'status');

  return (
    <div className="trace-reader__row" data-disclosed={disclosed}>
      <button
        type="button"
        className="trace-reader__row-head"
        aria-expanded={disclosed}
        onClick={() => setDisclosed((open) => !open)}
      >
        <span className="trace-reader__row-kind">{KIND_LABEL[record.kind]}</span>
        <span className="trace-reader__row-title">{record.title}</span>
        {status && <span className="trace-reader__row-status">{status}</span>}
      </button>
      {disclosed && (
        <div className="trace-reader__row-body">
          {summary && <p>{summary}</p>}
          <span className="trace-reader__row-count">
            {graph.related(record.id).length} connected objects
          </span>
          <div className="trace-reader__row-actions">
            <button type="button" onClick={() => onInspect(record)}>Inspect this</button>
            {commands.canOpen(record) && (
              <button
                type="button"
                className="trace-reader__open"
                onClick={() => commands.open(record)}
              >
                Open {KIND_LABEL[record.kind]} ↗
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RelatedSection({
  heading,
  records,
  graph,
  commands,
  onInspect,
}: {
  heading: string;
  records: readonly ObjectRecord[];
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  onInspect: (record: ObjectRecord) => void;
}) {
  if (records.length === 0) return null;
  return (
    <section className="trace-reader__section">
      <h3>{heading}<span>{records.length}</span></h3>
      {records.slice(0, MAX_RELATED_ROWS).map((record) => (
        <RelatedRow
          key={`${heading}:${record.id}`}
          record={record}
          graph={graph}
          commands={commands}
          onInspect={onInspect}
        />
      ))}
    </section>
  );
}

/** Every relationship the selected object carries, one section per relation. */
function RelatedContext({
  selected,
  graph,
  commands,
  onInspect,
}: {
  selected: ObjectRecord;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  onInspect: (record: ObjectRecord) => void;
}) {
  const sections = relationsFor(selected.kind)
    .map((relation) => ({ relation, records: graph.relatedBy(selected.id, relation) }))
    .filter((section) => section.records.length > 0);

  if (selected.kind === 'message') {
    return (
      <RelatedSection
        heading="Referenced here"
        records={graph.relatedBy(selected.id, 'references')}
        graph={graph}
        commands={commands}
        onInspect={onInspect}
      />
    );
  }

  return (
    <>
      {sections.map((section) => (
        <RelatedSection
          key={section.relation}
          heading={section.relation === 'blocks' ? 'Blocking' : 'Related'}
          records={section.records}
          graph={graph}
          commands={commands}
          onInspect={onInspect}
        />
      ))}
    </>
  );
}

function IdentityFacts({ record }: { record: ObjectRecord }) {
  const facts = factsFor(record).filter((fact) => field(record, fact.from));
  if (facts.length === 0) return null;
  return (
    <section className="trace-reader__section">
      <h3>Identity</h3>
      {facts.map((fact) => (
        <div className="trace-reader__fact" key={fact.from}>
          <span>{fact.label}</span>
          <strong>{field(record, fact.from)}</strong>
        </div>
      ))}
    </section>
  );
}

function ContextRow({
  label,
  record,
  commands,
}: {
  label: string;
  record: ObjectRecord;
  commands: MessagesDesignCommands;
}) {
  return (
    <div className="trace-reader__context-row">
      <span>{label}</span>
      <strong>{record.title}</strong>
      {commands.canOpen(record) && (
        <button type="button" onClick={() => commands.open(record)}>Open ↗</button>
      )}
    </div>
  );
}

/**
 * The conversation this moment belongs to.
 *
 * The Mission row is rendered only when the conversation actually relates to one.
 */
function ConversationContext({
  trace,
  commands,
}: {
  trace: WaveTrace;
  commands: MessagesDesignCommands;
}) {
  return (
    <section className="trace-reader__section">
      <h3>Context</h3>
      {trace.agent && <ContextRow label="Agent" record={trace.agent} commands={commands} />}
      {trace.mission && <ContextRow label="Mission" record={trace.mission} commands={commands} />}
    </section>
  );
}

/** Reads one selected moment without moving the user. */
export function TraceReaderInspector({
  selected,
  trace,
  graph,
  commands,
  panelRef,
  onClose,
  onInspect,
}: {
  selected: ObjectRecord;
  trace: WaveTrace;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onInspect: (record: ObjectRecord) => void;
}) {
  useDismissOnEscape(onClose);
  const body = field(selected, 'body') || summaryFor(selected) || selected.title;

  return (
    <aside ref={panelRef} className="trace-reader" aria-label="Trace reader">
      <header className="trace-reader__header">
        <div>
          <span className="trace-reader__kind">{KIND_LABEL[selected.kind]}</span>
          <span className="trace-reader__moment">{momentLabel(selected)}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close trace reader">×</button>
      </header>
      <TraceReaderClock trace={trace} record={selected} />
      <p className="trace-reader__body">{body}</p>
      <div className="trace-reader__scroll">
        {selected.kind !== 'message' && <IdentityFacts record={selected} />}
        <RelatedContext
          selected={selected}
          graph={graph}
          commands={commands}
          onInspect={onInspect}
        />
        <ConversationContext trace={trace} commands={commands} />
      </div>
    </aside>
  );
}
