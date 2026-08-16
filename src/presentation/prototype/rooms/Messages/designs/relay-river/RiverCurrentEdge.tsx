import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { RiverEdge } from './relay-river-projection';

/** Draws one subdued chronological segment; it never represents an object relation. */
export function RiverCurrentEdge(props: EdgeProps<RiverEdge>) {
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.34,
  });
  return (
    <>
      <BaseEdge path={path} className="river-current river-current--bed" />
      <BaseEdge
        path={path}
        className="river-current river-current--line"
        data-reaches-now={props.data?.reachesNow ?? false}
      />
    </>
  );
}
