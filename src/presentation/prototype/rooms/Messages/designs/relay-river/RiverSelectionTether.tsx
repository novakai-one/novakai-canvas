type Point = { readonly x: number; readonly y: number };
type Bounds = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Draws the only relationship-like line allowed in the selected state. */
export function RiverSelectionTether({
  source,
  inspector,
  width,
  height,
}: {
  source: Point | null;
  inspector: Bounds | null;
  width: number;
  height: number;
}) {
  if (!source || !inspector) return null;
  const targetX = inspector.left;
  const targetY = Math.max(inspector.top + 36, Math.min(source.y, inspector.top + inspector.height - 36));
  const span = Math.max(32, Math.min(150, (targetX - source.x) * 0.45));
  const path = `M ${source.x} ${source.y} C ${source.x + span} ${source.y}, ${targetX - span} ${targetY}, ${targetX} ${targetY}`;

  return (
    <svg
      className="river-selection-tether"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} />
      <circle cx={source.x} cy={source.y} r="4" />
    </svg>
  );
}
