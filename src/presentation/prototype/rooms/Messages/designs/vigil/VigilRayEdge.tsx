import { getStraightPath, type EdgeProps } from '@xyflow/react';
import type { RayFlowEdge } from './vigil-projection';

/**
 * One segment of the opened conversation's ray.
 *
 * The line fades as the exchange recedes, so the trail reads as light falling off
 * with distance rather than as a diagram connector. Rays are never gold — the accent
 * belongs to the one thing that needs answering, not to structure.
 */
export function VigilRayEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<RayFlowEdge>) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <path
      className="vigil-ray"
      d={path}
      style={{ opacity: data?.fade ?? 0.4 }}
      fill="none"
    />
  );
}
