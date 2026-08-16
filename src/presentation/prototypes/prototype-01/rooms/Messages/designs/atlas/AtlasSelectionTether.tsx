import type { Point } from './atlas-geometry';

export type InspectorBounds = { left: number; top: number; width: number; height: number };

export function AtlasSelectionTether({
  point,
  inspector,
  width,
  height,
}: {
  point: Point | null;
  inspector: InspectorBounds | null;
  width: number;
  height: number;
}) {
  if (!point || !inspector || point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
    return null;
  }
  const targetX = point.x < inspector.left ? inspector.left : inspector.left + inspector.width;
  const targetY = Math.max(inspector.top + 28, Math.min(point.y, inspector.top + inspector.height - 28));
  const direction = targetX > point.x ? 1 : -1;
  const span = Math.min(180, Math.abs(targetX - point.x) * 0.48);
  const path = `M ${point.x} ${point.y} C ${point.x + span * direction} ${point.y}, ${targetX - span * direction} ${targetY}, ${targetX} ${targetY}`;

  return (
    <svg className="atlas-tether" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="atlas-tether__shadow" d={path} />
      <path className="atlas-tether__line" d={path} />
      <circle className="atlas-tether__origin" cx={point.x} cy={point.y} r="5" />
    </svg>
  );
}
