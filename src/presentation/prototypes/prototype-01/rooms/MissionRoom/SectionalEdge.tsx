import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { MissionStageFlowEdge } from './graph-to-flow';
import './sectional-edge.css';

/** Rails make sequence and recursive structure read as constructed space. */
export function SectionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<MissionStageFlowEdge>) {
  const kind = data?.kind ?? 'sequence';
  const path = kind === 'sequence'
    ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
    : getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 3,
        offset: 72,
      })[0];

  return (
    <g
      className="sectional-edge"
      data-kind={kind}
      data-depth={data?.depth ?? 0}
      data-emphasized={data?.emphasized ?? false}
    >
      <BaseEdge id={`${id}:bed`} path={path} className="sectional-edge__bed" />
      <BaseEdge id={id} path={path} className="sectional-edge__rail" />
      <path
        className="sectional-edge__arrow"
        d={`M ${targetX - 7} ${targetY - 4} L ${targetX} ${targetY} L ${targetX - 7} ${targetY + 4}`}
      />
      <circle className="sectional-edge__joint" cx={sourceX} cy={sourceY} r={3.2} />
    </g>
  );
}
