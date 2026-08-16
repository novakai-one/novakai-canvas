/**
 * One faint line from the selected moment to the panel reading it.
 *
 * Without it the inspector is a panel that happens to be open; with it, the panel is
 * visibly about that bead. It is the only connector the design draws, and it exists only
 * while something is selected.
 */
type Point = { x: number; y: number };
type PanelBounds = { left: number; top: number; width: number; height: number };

function panelEdgeFor(panel: PanelBounds, source: Point): Point {
  return { x: panel.left, y: Math.min(Math.max(source.y, panel.top + 24), panel.top + panel.height - 24) };
}

/** Draws the selection tether across the canvas screen plane. */
export function WaveSelectionTether({
  source,
  panel,
  width,
  height,
}: {
  source: Point | null;
  panel: PanelBounds | null;
  width: number;
  height: number;
}) {
  if (!source || !panel) return null;
  const target = panelEdgeFor(panel, source);

  return (
    <svg className="wave-tether" width={width} height={height} aria-hidden="true">
      <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} />
      <circle cx={source.x} cy={source.y} r={3} />
    </svg>
  );
}
