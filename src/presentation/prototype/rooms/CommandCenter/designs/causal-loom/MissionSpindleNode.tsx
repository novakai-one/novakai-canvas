import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { LoomZoomTier } from './causal-loom-model';

export type MissionSpindleNodeData = {
  readonly mission: ObjectRecord | null;
  readonly title: string;
  readonly attentionCount: number;
  readonly containsElected: boolean;
  readonly tier: LoomZoomTier;
  readonly dimmed: boolean;
  readonly onSelect: (id: string) => void;
};

export type MissionSpindleFlowNode = Node<MissionSpindleNodeData, 'mission-spindle'>;

/** The mission is a field-sized object; only its small core owns pointer input. */
export function MissionSpindleNode({ data, selected }: NodeProps<MissionSpindleFlowNode>) {
  return (
    <div
      className="mission-spindle"
      data-elected={data.containsElected}
      data-selected={selected}
      data-dimmed={data.dimmed}
      data-tier={data.tier}
    >
      <Handle id="field" type="source" position={Position.Right} />
      <span className="mission-spindle__shadow" aria-hidden="true" />
      <span className="mission-spindle__ring mission-spindle__ring--outer" aria-hidden="true" />
      <span className="mission-spindle__ring mission-spindle__ring--middle" aria-hidden="true" />
      <span className="mission-spindle__ring mission-spindle__ring--inner" aria-hidden="true" />
      <span className="mission-spindle__arc mission-spindle__arc--one" aria-hidden="true" />
      <span className="mission-spindle__arc mission-spindle__arc--two" aria-hidden="true" />
      {data.mission ? (
        <button
          type="button"
          className="mission-spindle__core nodrag nopan"
          onClick={(event) => {
            event.stopPropagation();
            data.onSelect(data.mission?.id ?? '');
          }}
          aria-label={`Inspect Mission ${data.title}`}
        >
          <span className="mission-spindle__kind">MISSION / {String(data.attentionCount).padStart(2, '0')}</span>
          <span className="mission-spindle__title">{data.title}</span>
        </button>
      ) : (
        <div className="mission-spindle__core mission-spindle__core--loose" aria-label="Loose threads">
          <span className="mission-spindle__kind">UNBOUND / {String(data.attentionCount).padStart(2, '0')}</span>
          <span className="mission-spindle__title">{data.title}</span>
        </div>
      )}
    </div>
  );
}
