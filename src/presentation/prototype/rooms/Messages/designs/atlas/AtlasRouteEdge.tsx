import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { AtlasEdge } from './atlas-projection';

export function AtlasRouteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<AtlasEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: data?.kind === 'reference' ? 0.32 : 0.52,
  });
  return (
    <BaseEdge
      id={id}
      path={path}
      className="atlas-route"
      data-kind={data?.kind}
      data-focused={data?.focused}
      data-dimmed={data?.dimmed}
      data-traversing={data?.traversing}
      style={{ '--route-order': data?.order ?? 0 } as React.CSSProperties}
    />
  );
}
