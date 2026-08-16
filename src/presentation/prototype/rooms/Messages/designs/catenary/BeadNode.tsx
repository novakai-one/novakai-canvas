import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CableNode } from './catenary-projection';

type BeadData = CableNode['data'];

/** Edges need somewhere to attach; the cable's ends should not be visible furniture. */
function CableHandles({ position }: { position: Position }) {
  const type = position === Position.Right ? 'source' : 'target';
  return <Handle type={type} position={position} className="catenary-handle" isConnectable={false} />;
}

function AgentAnchor({ data }: { data: BeadData }) {
  return (
    <div className="catenary-anchor catenary-anchor--agent">
      <span className="catenary-anchor__role">{data.agentRole}</span>
      <strong className="catenary-anchor__name">{data.agentName}</strong>
      <div className="catenary-anchor__context">
        {data.missionTitle && (
          <span className="catenary-anchor__mission">{data.missionTitle}</span>
        )}
        {data.waitingLabel && (
          <span className="catenary-anchor__waiting">{data.waitingLabel}</span>
        )}
      </div>
      <CableHandles position={Position.Right} />
    </div>
  );
}

function YouAnchor() {
  return (
    <div className="catenary-anchor catenary-anchor--you">
      <CableHandles position={Position.Left} />
      <span className="catenary-anchor__role">you</span>
    </div>
  );
}

function TurnBead({ data }: { data: BeadData }) {
  return (
    <div className="catenary-bead" data-mine={data.mine} data-loaded={data.loaded}>
      <span className="catenary-bead__dot" />
      <article className="catenary-bead__card">
        <span className="catenary-bead__meta">
          {data.mine ? 'you' : data.agentName} · {data.time}
        </span>
        <p className="catenary-bead__body">{data.body}</p>
        {data.waitingLabel && (
          <span className="catenary-bead__waiting">{data.waitingLabel}</span>
        )}
      </article>
    </div>
  );
}

/** Everything past the stage, held as a count instead of a screenful of thin lines. */
function OffStageTally({ data }: { data: BeadData }) {
  return (
    <div className="catenary-tally" data-waiting={data.offStageWaiting > 0}>
      <span className="catenary-tally__marks" aria-hidden="true">
        {Array.from({ length: Math.min(data.offStageCount, 12) }, (_, index) => (
          <i key={index} />
        ))}
      </span>
      <strong>{data.offStageCount} more conversations</strong>
      <span className="catenary-tally__waiting">
        {data.offStageWaiting > 0 ? `${data.offStageWaiting} waiting` : 'none waiting'}
      </span>
    </div>
  );
}

/** One point on a cable: an anchor at either end, or a single turn in between. */
export function BeadNode({ data, selected }: NodeProps<CableNode>) {
  return (
    <div
      className="catenary-node"
      data-variant={data.variant}
      data-depth={data.depth}
      data-focused={data.focused}
      data-selected={selected}
    >
      {data.variant === 'agentAnchor' && <AgentAnchor data={data} />}
      {data.variant === 'youAnchor' && <YouAnchor />}
      {data.variant === 'bead' && <TurnBead data={data} />}
      {data.variant === 'tally' && <OffStageTally data={data} />}
    </div>
  );
}
