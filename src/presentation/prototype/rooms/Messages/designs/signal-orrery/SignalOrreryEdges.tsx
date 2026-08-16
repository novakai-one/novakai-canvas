import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { OrreryEdge } from './signal-orrery-geometry';

/** Draws restrained chronology arcs and disclosed relationship tethers. */
export function SignalOrreryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<OrreryEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: data?.kind === 'context' ? 0.34 : 0.52,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      className="signal-orrery-edge"
      data-kind={data?.kind}
      data-depth={data?.depth}
    />
  );
}
