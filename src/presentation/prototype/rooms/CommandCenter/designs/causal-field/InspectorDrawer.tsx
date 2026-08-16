/**
 * The Room's inspector, grown out of the field instead of docked beside it.
 *
 * It pushes the canvas up rather than covering it, and its related rows are the
 * chips already standing on the field: disclosing one lights that chip in place.
 * Navigation stays a separate, arrow-labelled act — nothing here moves you.
 */
import { useEffect, useRef, useState } from 'react';
import './inspector-drawer.css';
import type { AttentionAction, AttentionItem } from '../../../../attention/feed';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import { factsFor, summaryFor } from '../../../../components/InspectorPanel/inspector-content';
import { Eyebrow, Field, RoomAction } from '../../../../components/ui/ui';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 560;

function ChainRow({
  record,
  verb,
  lit,
  onLight,
  graph,
  onSelect,
  canOpen,
  onOpen,
}: {
  record: ObjectRecord;
  verb: string | null;
  lit: boolean;
  onLight(id: string | null): void;
  graph: ObjectGraph;
  onSelect(id: string | null): void;
  canOpen(record: ObjectRecord): boolean;
  onOpen(record: ObjectRecord): void;
}) {
  const preview = summaryFor(record) || field(record, 'body') || field(record, 'result');
  const connections = graph.related(record.id).length;

  return (
    <div className="drawer-chain-row" data-lit={lit}>
      <button
        type="button"
        className="drawer-chain-row__disclose"
        aria-expanded={lit}
        onClick={() => onLight(lit ? null : record.id)}
      >
        <span className="drawer-chain-row__identity">
          <span className="eyebrow">
            {KIND_LABEL[record.kind]}
            {verb ? ` · ${verb}` : ''}
          </span>
          <span className="drawer-chain-row__title">{record.title}</span>
        </span>
      </button>
      {canOpen(record) && (
        <button
          type="button"
          className="drawer-chain-row__open"
          title={`Open ${KIND_LABEL[record.kind]} — ${record.title}`}
          aria-label={`Open ${record.title}`}
          onClick={() => onOpen(record)}
        >
          ↗
        </button>
      )}
      {lit && (
        <div className="drawer-chain-row__context">
          {preview && <p>{preview}</p>}
          <div className="drawer-chain-row__context-meta">
            <span>
              {connections} connected {connections === 1 ? 'object' : 'objects'}
            </span>
            <button type="button" className="drawer-chain-row__inspect" onClick={() => onSelect(record.id)}>
              Inspect this instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function InspectorDrawer({
  subject,
  item,
  chain,
  litId,
  onLight,
  onAct,
  height,
  onResize,
  graph,
  onSelect,
  canOpen,
  onOpen,
}: {
  subject: ObjectRecord;
  /** The feed item whose chain the subject belongs to, when it has one. */
  item: AttentionItem | null;
  /** Field co-members of the subject's chain, with the verb that reaches each. */
  chain: readonly { record: ObjectRecord; verb: string | null }[];
  litId: string | null;
  onLight(id: string | null): void;
  onAct(item: AttentionItem, kind: AttentionAction['kind'], answer?: string): void;
  height: number;
  onResize(height: number): void;
  graph: ObjectGraph;
  onSelect(id: string | null): void;
  canOpen(record: ObjectRecord): boolean;
  onOpen(record: ObjectRecord): void;
}) {
  const [answered, setAnswered] = useState<string | null>(null);
  const dragFrom = useRef<{ pointerY: number; height: number } | null>(null);

  useEffect(() => setAnswered(null), [subject.id]);

  const facts = factsFor(subject);
  const summary = summaryFor(subject);
  const options = Array.isArray(subject.fields.options) ? (subject.fields.options as string[]) : [];
  const pending = subject.kind === 'request' && field(subject, 'status') === 'pending';
  const openTarget = item ? (graph.get(item.openId) ?? subject) : subject;
  const openRecord = canOpen(openTarget) ? openTarget : subject;

  const startResize = (event: React.PointerEvent) => {
    dragFrom.current = { pointerY: event.clientY, height };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const moveResize = (event: React.PointerEvent) => {
    if (!dragFrom.current) return;
    const next = dragFrom.current.height + (dragFrom.current.pointerY - event.clientY);
    onResize(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next)));
  };

  return (
    <section className="inspector-drawer" style={{ height }} aria-label="Inspector">
      <div
        className="inspector-drawer__handle"
        data-dragging={dragFrom.current !== null}
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={() => {
          dragFrom.current = null;
        }}
      />
      <header className="inspector-drawer__header">
        <div className="inspector-drawer__identity">
          <Eyebrow kind={subject.kind} />
          <h2 className="inspector-drawer__title">{subject.title}</h2>
        </div>
        {canOpen(openRecord) && (
          <RoomAction onClick={() => onOpen(openRecord)}>
            Open {KIND_LABEL[openRecord.kind]}
          </RoomAction>
        )}
      </header>

      <div className="inspector-drawer__body">
        <div className="inspector-drawer__column inspector-drawer__column--identity">
          {summary && <p className="inspector-drawer__summary">{summary}</p>}
          {facts.map((fact) => (
            <Field key={fact.label} label={fact.label}>
              {field(subject, fact.from)}
            </Field>
          ))}
          <Field label="Object id">
            <code className="inspector-drawer__id">{subject.id}</code>
          </Field>
        </div>

        <div className="inspector-drawer__column inspector-drawer__column--act">
          {pending && item && (
            <>
              <h3 className="inspector-drawer__column-label">Your answer</h3>
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="inspector-drawer__option"
                  data-chosen={answered === option}
                  onClick={() => {
                    setAnswered(option);
                    onAct(item, 'respond', option);
                  }}
                >
                  {option}
                </button>
              ))}
            </>
          )}
          {!pending && item && item.actions.length > 0 && (
            <>
              <h3 className="inspector-drawer__column-label">Act</h3>
              {item.actions.map((action) => (
                <button
                  key={action.kind + action.label}
                  type="button"
                  className="inspector-drawer__option"
                  onClick={() => onAct(item, action.kind)}
                >
                  {action.label}
                </button>
              ))}
            </>
          )}
          {!item && <p className="inspector-drawer__quiet">Part of the chain at right — act from its root.</p>}
        </div>

        <div className="inspector-drawer__column inspector-drawer__column--chain">
          <h3 className="inspector-drawer__column-label">Chain</h3>
          {chain.length === 0 && <p className="inspector-drawer__quiet">Nothing hangs from this.</p>}
          {chain.map(({ record, verb }) => (
            <ChainRow
              key={record.id}
              record={record}
              verb={verb}
              lit={litId === record.id}
              onLight={onLight}
              graph={graph}
              onSelect={onSelect}
              canOpen={canOpen}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
