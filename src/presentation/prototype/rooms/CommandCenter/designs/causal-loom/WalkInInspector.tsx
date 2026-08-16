import { useEffect, useState } from 'react';
import { REASON_LABEL, type AttentionAction, type AttentionItem } from '../../../../attention/feed';
import { KIND_LABEL, RELATION_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import { summaryFor } from '../../../../components/InspectorPanel/inspector-content';
import {
  REPLACEMENT_AGENTS,
  type CommandActionInput,
  type CommandOutcome,
} from '../../command-center-design';
import type { LoomInspectorContext } from './causal-loom-model';

const CONSEQUENCE: Partial<Record<AttentionItem['reason'], string>> = {
  decision: 'Delivery remains held until a choice is recorded.',
  'agent-failed': 'The requested seat has no working presence.',
  blocked: 'Downstream work cannot advance.',
  'seat-vacant': 'Capacity exists on paper, but not in execution.',
  issue: 'A high-severity risk remains open.',
  'message-waiting': 'A conversation is waiting for human direction.',
  milestone: 'The next operational boundary is approaching.',
  completed: 'The outcome is ready to leave the attention field.',
};

type InputMode = AttentionAction['kind'] | null;

function commandLabel(action: AttentionAction['kind'], item: AttentionItem): string {
  if (action === 'approve') return 'Approve';
  if (action === 'reassign') return item.reason === 'seat-vacant' ? 'Assign' : 'Reassign';
  if (action === 'clear') return 'Clear';
  if (action === 'respond') return 'Respond';
  return 'Stop';
}

function ContextBand({
  label,
  entries,
  openId,
  onToggle,
  canOpen,
  onOpen,
}: {
  label: string;
  entries: LoomInspectorContext[keyof LoomInspectorContext];
  openId: string | null;
  onToggle: (id: string) => void;
  canOpen(record: ObjectRecord): boolean;
  onOpen(record: ObjectRecord): void;
}) {
  return (
    <section className="walk-in__band">
      <h3>{label}<span>{entries.length}</span></h3>
      {entries.length === 0 ? (
        <p className="walk-in__empty">No {label.toLowerCase()} within two hops.</p>
      ) : entries.map(({ record, path }) => {
        const open = openId === record.id;
        return (
          <div className="walk-in__related" data-open={open} key={record.id}>
            <button type="button" className="walk-in__related-disclose" onClick={() => onToggle(record.id)} aria-expanded={open}>
              <span>{KIND_LABEL[record.kind]}</span>
              <strong>{record.title}</strong>
              <i aria-hidden="true">{open ? '−' : '+'}</i>
            </button>
            {canOpen(record) && (
              <button type="button" className="walk-in__related-open" onClick={() => onOpen(record)}>
                Open <span aria-hidden="true">↗</span>
              </button>
            )}
            {open && (
              <div className="walk-in__related-preview">
                <p>{summaryFor(record) || field(record, 'body') || 'Identified context object.'}</p>
                <span>{path.map((relation) => RELATION_LABEL[relation as keyof typeof RELATION_LABEL] ?? relation).join(' → ')}</span>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function WalkInInspector({
  graph,
  selected,
  item,
  context,
  outcome,
  ready,
  onFocus,
  onClose,
  onAction,
  canOpen,
  onOpen,
}: {
  graph: ObjectGraph;
  selected: ObjectRecord | null;
  item: AttentionItem | null;
  context: LoomInspectorContext | null;
  outcome: CommandOutcome | null;
  ready: boolean;
  onFocus: () => void;
  onClose: () => void;
  onAction: (kind: AttentionAction['kind'], input?: CommandActionInput) => CommandOutcome;
  canOpen(record: ObjectRecord): boolean;
  onOpen(record: ObjectRecord): void;
}) {
  const [openRelatedId, setOpenRelatedId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>(null);

  useEffect(() => {
    setOpenRelatedId(null);
    setInputMode(null);
  }, [selected?.id]);

  const primaryRecord = item ? graph.get(item.openId) : selected;
  const primaryCanOpen = primaryRecord ? canOpen(primaryRecord) : false;
  const locked = outcome?.state === 'applied';
  const options = item && Array.isArray(item.subject.fields.options)
    ? item.subject.fields.options.filter((option): option is string => typeof option === 'string')
    : [];

  return (
    <aside
      className="walk-in"
      data-open={Boolean(selected)}
      data-ready={ready}
      aria-hidden={!selected}
      aria-label="Command Center inspector"
    >
      <span className="walk-in__notch" data-loom-inspector-notch aria-hidden="true" />
      {selected && (
        <>
          <header className="walk-in__header">
            <div className="walk-in__identity">
              <span className="walk-in__eyebrow">
                {item ? REASON_LABEL[item.reason] : KIND_LABEL[selected.kind]}
              </span>
              <h2>{selected.title}</h2>
              <div className="walk-in__status-line">
                <span>{KIND_LABEL[selected.kind]}</span>
                <span>{field(selected, 'status') || 'context'}</span>
                <span>{item?.since || 'now'}</span>
              </div>
            </div>
            <div className="walk-in__header-actions">
              <button type="button" onClick={onFocus}>Focus</button>
              <button type="button" onClick={onClose} aria-label="Close inspector">×</button>
            </div>
          </header>

          <div className="walk-in__body">
            <section className="walk-in__causality">
              <div>
                <span>CAUSE</span>
                <p>{item?.detail || summaryFor(selected) || 'Selected mission context.'}</p>
              </div>
              <div>
                <span>CONSEQUENCE</span>
                <p>{item ? CONSEQUENCE[item.reason] : 'Its attention objects orbit this operational field.'}</p>
              </div>
            </section>

            {item && item.actions.length > 0 && (
              <section className="walk-in__commands" aria-label="Available actions">
                <div className="walk-in__command-row">
                  {item.actions.map((action) => (
                    <button
                      type="button"
                      key={action.kind}
                      disabled={locked}
                      data-primary={action.kind === 'respond' || action.kind === 'approve'}
                      onClick={() => {
                        if (action.kind === 'respond' || action.kind === 'reassign' || action.kind === 'stop') {
                          setInputMode((current) => current === action.kind ? null : action.kind);
                        } else {
                          onAction(action.kind);
                        }
                      }}
                    >
                      {commandLabel(action.kind, item)}
                    </button>
                  ))}
                </div>

                {inputMode === 'respond' && (
                  <div className="walk-in__choice-strip">
                    {options.map((option) => (
                      <button type="button" key={option} onClick={() => onAction('respond', { response: option })}>{option}</button>
                    ))}
                    {options.length === 0 && <button type="button" onClick={() => onAction('respond', { response: 'Approved' })}>Approve response</button>}
                  </div>
                )}
                {inputMode === 'reassign' && (
                  <div className="walk-in__choice-strip">
                    {REPLACEMENT_AGENTS.map((name) => (
                      <button type="button" key={name} onClick={() => onAction('reassign', { replacement: name })}>{name}</button>
                    ))}
                  </div>
                )}
                {inputMode === 'stop' && (
                  <div className="walk-in__confirm">
                    <span>This retires the current agent presence.</span>
                    <button type="button" onClick={() => onAction('stop', { confirmed: true })}>Confirm stop</button>
                  </div>
                )}
                {outcome && <p className="walk-in__outcome" data-state={outcome.state}>{outcome.message}</p>}
              </section>
            )}

            {context && (
              <div className="walk-in__context">
                <ContextBand label="Mission" entries={context.mission} openId={openRelatedId} onToggle={(id) => setOpenRelatedId(openRelatedId === id ? null : id)} canOpen={canOpen} onOpen={onOpen} />
                <ContextBand label="Agent" entries={context.agent} openId={openRelatedId} onToggle={(id) => setOpenRelatedId(openRelatedId === id ? null : id)} canOpen={canOpen} onOpen={onOpen} />
                <ContextBand label="Message" entries={context.message} openId={openRelatedId} onToggle={(id) => setOpenRelatedId(openRelatedId === id ? null : id)} canOpen={canOpen} onOpen={onOpen} />
                <ContextBand label="Evidence" entries={context.evidence} openId={openRelatedId} onToggle={(id) => setOpenRelatedId(openRelatedId === id ? null : id)} canOpen={canOpen} onOpen={onOpen} />
              </div>
            )}
          </div>

          {primaryCanOpen && primaryRecord && (
            <footer className="walk-in__footer">
              <span>Navigation is explicit</span>
              <button type="button" onClick={() => onOpen(primaryRecord)}>
                Open {KIND_LABEL[primaryRecord.kind]} <span aria-hidden="true">↗</span>
              </button>
            </footer>
          )}
        </>
      )}
    </aside>
  );
}
