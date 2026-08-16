import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { REASON_LABEL, type AttentionItem } from '../../../../attention/feed';
import { KIND_LABEL } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { LoomZoomTier } from './causal-loom-model';

export type LoomKnotNodeData = {
  readonly item: AttentionItem;
  readonly tier: LoomZoomTier;
  readonly elected: boolean;
  readonly selected: boolean;
  readonly dimmed: boolean;
  readonly releasing: boolean;
  readonly onSelect: (id: string) => void;
};

export type LoomKnotFlowNode = Node<LoomKnotNodeData, 'loom-knot'>;

function consequence(item: AttentionItem): string {
  if (item.reason === 'decision') return 'Delivery remains held until a choice is recorded.';
  if (item.reason === 'agent-failed') return 'The requested seat has no working presence.';
  if (item.reason === 'blocked') return 'Downstream work cannot advance.';
  if (item.reason === 'seat-vacant') return 'Capacity exists on paper, but not in execution.';
  if (item.reason === 'message-waiting') return 'A conversation is waiting for human direction.';
  if (item.reason === 'issue') return 'A high-severity risk remains open.';
  if (item.reason === 'milestone') return 'The next operational boundary is approaching.';
  return 'The outcome is ready to leave the attention field.';
}

/** An attention object changes silhouette and information density with semantic zoom. */
export function LoomKnotNode({ data }: NodeProps<LoomKnotFlowNode>) {
  const status = field(data.item.subject, 'status') || data.item.reason;
  return (
    <article
      className="loom-knot"
      data-reason={data.item.reason}
      data-tier={data.tier}
      data-elected={data.elected}
      data-selected={data.selected}
      data-dimmed={data.dimmed}
      data-releasing={data.releasing}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <Handle id="in" type="target" position={Position.Left} />
      <Handle id="out" type="source" position={Position.Right} />
      <button
        type="button"
        className="loom-knot__hit"
        onClick={(event) => {
          event.stopPropagation();
          data.onSelect(data.item.subject.id);
        }}
        aria-label={`Inspect ${data.item.label}`}
      >
        <span className="loom-knot__glyph" aria-hidden="true"><i /></span>
        <span className="loom-knot__body">
          <span className="loom-knot__meta">
            {REASON_LABEL[data.item.reason]} · {data.item.since || 'now'}
          </span>
          <strong className="loom-knot__title">{data.item.label}</strong>
          <span className="loom-knot__status">{KIND_LABEL[data.item.subject.kind]} / {status}</span>
          {data.tier === 'detail' && data.selected && (
            <span className="loom-knot__detail">
              <span><b>CAUSE</b>{data.item.detail}</span>
              <span><b>CONSEQUENCE</b>{consequence(data.item)}</span>
            </span>
          )}
        </span>
      </button>
    </article>
  );
}
