import { useState } from 'react';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import type { VigilLantern } from './vigil-model';

/**
 * Lantern Core — the opened lantern's inside.
 *
 * It discloses in three steps and never navigates on its own: selecting shows what
 * this is, clicking a related object reveals that object's own context in place, and
 * only the explicit Open leaves the Room. The composer lives here too, beside the
 * conversation it answers.
 */
export function LanternCore({
  lantern,
  selected,
  graph,
  commands,
  unfurled,
  onShowExchange,
  onClose,
}: {
  lantern: VigilLantern | null;
  selected: ObjectRecord | null;
  graph: ObjectGraph;
  commands: MessagesDesignCommands;
  unfurled: boolean;
  onShowExchange: (threadId: string) => void;
  onClose: () => void;
}) {
  if (!lantern) return null;
  const subject = selected ?? lantern.record;

  return (
    <aside className="lantern-core" aria-label="Lantern Core">
      <CoreHeader subject={subject} lantern={lantern} onClose={onClose} />
      <CoreContext lantern={lantern} subject={subject} />
      {!unfurled && (
        <button
          type="button"
          className="lantern-core__unfurl"
          onClick={() => onShowExchange(lantern.record.id)}
        >
          Show exchange on the floor
        </button>
      )}
      <CoreRelated
        records={relatedRecords(graph, lantern, subject)}
        commands={commands}
      />
      <CoreComposer
        threadId={lantern.record.id}
        agentName={lantern.agentName}
        onSend={commands.send}
      />
    </aside>
  );
}

/** What the panel is currently reading out, and the way back to the whole conversation. */
function CoreHeader({
  subject,
  lantern,
  onClose,
}: {
  subject: ObjectRecord;
  lantern: VigilLantern;
  onClose: () => void;
}) {
  const isThread = subject.kind === 'thread';

  return (
    <header className="lantern-core__header">
      <span className="lantern-core__eyebrow">
        {isThread ? 'Conversation' : KIND_LABEL[subject.kind]}
      </span>
      <h2 className="lantern-core__title">
        {isThread ? lantern.agentName : subject.title}
      </h2>
      <button type="button" className="lantern-core__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </header>
  );
}

/**
 * The conversation's own context.
 *
 * Mission is rendered only when the thread really discusses one. A standalone
 * conversation shows nothing in its place — no empty slot and no invented parent.
 */
function CoreContext({ lantern, subject }: { lantern: VigilLantern; subject: ObjectRecord }) {
  const body = subject.kind === 'message' ? subject.title : '';

  return (
    <div className="lantern-core__context">
      <dl className="lantern-core__facts">
        <div>
          <dt>Agent</dt>
          <dd>{lantern.agentName} · {lantern.agentRole}</dd>
        </div>
        <div>
          <dt>Last spoke</dt>
          <dd>{lantern.moments[0] ? field(lantern.moments[0].record, 'createdAt').slice(11, 16) : '—'}</dd>
        </div>
        {lantern.mission && (
          <div>
            <dt>Mission</dt>
            <dd>{lantern.mission.title}</dd>
          </div>
        )}
      </dl>
      {body && <p className="lantern-core__body">{body}</p>}
    </div>
  );
}

/** Related objects, each disclosing its own context before it will navigate anywhere. */
function CoreRelated({
  records,
  commands,
}: {
  records: readonly ObjectRecord[];
  commands: MessagesDesignCommands;
}) {
  if (records.length === 0) return null;

  return (
    <section className="lantern-core__related">
      <span className="lantern-core__eyebrow">In this conversation</span>
      {records.map((record) => (
        <RelatedRow key={record.id} record={record} commands={commands} />
      ))}
    </section>
  );
}

function RelatedRow({
  record,
  commands,
}: {
  record: ObjectRecord;
  commands: MessagesDesignCommands;
}) {
  const [disclosed, setDisclosed] = useState(false);
  const detail = previewOf(record);

  return (
    <div className="lantern-core__row" data-disclosed={disclosed}>
      <button
        type="button"
        className="lantern-core__row-label"
        aria-expanded={disclosed}
        onClick={() => setDisclosed((current) => !current)}
      >
        <span>{KIND_LABEL[record.kind]}</span>
        <strong>{record.title}</strong>
      </button>
      {disclosed && (
        <div className="lantern-core__row-context">
          {detail && <p>{detail}</p>}
          {commands.canOpen(record) && (
            <button
              type="button"
              className="lantern-core__open"
              onClick={() => commands.open(record)}
            >
              Open {KIND_LABEL[record.kind]} ↗
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CoreComposer({
  threadId,
  agentName,
  onSend,
}: {
  threadId: string;
  agentName: string;
  onSend: (threadId: string, body: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(threadId, body);
    setDraft('');
  };

  return (
    <div className="lantern-core__composer">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={`Message ${agentName}`}
        rows={3}
      />
      <button type="button" className="lantern-core__send" onClick={send} disabled={!draft.trim()}>
        Send
      </button>
    </div>
  );
}

/** The first field that says something useful about a related object. */
function previewOf(record: ObjectRecord): string {
  return field(record, 'claim')
    || field(record, 'question')
    || field(record, 'blockedReason')
    || field(record, 'summary')
    || field(record, 'body')
    || field(record, 'status');
}

/**
 * What the panel offers next.
 *
 * A selected message offers what it referred to; the conversation itself offers what
 * it is stuck on and, when the relation exists, its Mission.
 */
function relatedRecords(
  graph: ObjectGraph,
  lantern: VigilLantern,
  subject: ObjectRecord,
): readonly ObjectRecord[] {
  if (subject.kind === 'message') return graph.relatedBy(subject.id, 'references');

  const records: ObjectRecord[] = [];
  if (lantern.pending) records.push(lantern.pending);
  if (lantern.mission) records.push(lantern.mission);
  if (lantern.agent) records.push(lantern.agent);
  return records;
}
