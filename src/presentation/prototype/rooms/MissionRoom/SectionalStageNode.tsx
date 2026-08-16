import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MouseEvent } from 'react';
import { field } from '../../object-graph/graph';
import type { MissionStageFlowNode } from './graph-to-flow';
import './sectional-stage-node.css';

function stopThen(event: MouseEvent, action: () => void) {
  event.stopPropagation();
  action();
}

function StatusGeometry({ status }: { status: string }) {
  return <span className="sectional-stage__status-geometry" data-status={status} aria-hidden="true" />;
}

/** A Stage rendered as a piece of the execution section, not a card on a graph. */
export function SectionalStageNode({ data, selected }: NodeProps<MissionStageFlowNode>) {
  const { placed, attention, tier, prominence, onReveal, onOpen } = data;
  const status = field(placed.record, 'status') || 'planned';
  const condition = field(placed.record, 'condition');

  return (
    <article
      className="sectional-stage"
      data-selected={selected}
      data-attention={attention}
      data-status={status}
      data-depth={placed.depth}
      data-tier={tier}
      data-prominence={prominence}
      data-revealed={placed.revealed}
    >
      <Handle id="sequence-in" type="target" position={Position.Top} />
      <Handle id="sequence-out" type="source" position={Position.Bottom} />
      <Handle id="branch-in" type="target" position={Position.Left} />
      <Handle id="branch-out" type="source" position={Position.Right} />

      <div className="sectional-stage__shadow" aria-hidden="true" />
      <div className="sectional-stage__platform" aria-hidden="true">
        <span className="sectional-stage__top-plane" />
        <span className="sectional-stage__deck-line" />
        <span className="sectional-stage__front-face" />
        <span className="sectional-stage__side-face" />
      </div>

      <div className="sectional-stage__pylon" aria-hidden="true">
        <span />
        <i />
      </div>

      <div className="sectional-stage__signal" aria-hidden="true">
        <span />
      </div>

      <span className="sectional-stage__section-code" aria-hidden="true">
        S/{placed.sequenceLabel}
      </span>

      {tier === 'overview' ? (
        <div className="sectional-stage__overview">
          <span className="sectional-stage__index">{placed.sequenceLabel}</span>
          <span className="sectional-stage__overview-title">{placed.record.title}</span>
          <StatusGeometry status={status} />
        </div>
      ) : (
        <div className="sectional-stage__content">
          <header className="sectional-stage__header">
            <span className="sectional-stage__index">{placed.sequenceLabel}</span>
            <span className="sectional-stage__kind">Stage · {status}</span>
            <StatusGeometry status={status} />
          </header>

          <h3 className="sectional-stage__title">{placed.record.title}</h3>
          {tier === 'detail' && condition && (
            <p className="sectional-stage__condition">{condition}</p>
          )}

          <div className="sectional-stage__actions nodrag nopan">
            {placed.hasChildren && (
              <button
                type="button"
                className="sectional-stage__action sectional-stage__action--reveal"
                data-revealed={placed.revealed}
                onClick={(event) => stopThen(event, onReveal)}
                title={placed.revealed ? 'Hide immediate structure' : 'Show immediate structure on canvas'}
              >
                <span aria-hidden="true">{placed.revealed ? '−' : '+'}</span>
                {placed.revealed ? 'Hide structure' : 'Show on canvas'}
              </button>
            )}
            <button
              type="button"
              className="sectional-stage__action sectional-stage__action--open"
              onClick={(event) => stopThen(event, onOpen)}
              title="Enter this Stage Room"
            >
              Open Stage <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
