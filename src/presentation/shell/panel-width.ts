/**
 * Panel geometry rules — the only place a panel width is decided.
 *
 * Kept free of React and of the canvas domain so the drag handler, the preference
 * reader, and the tests all agree on one definition of "a legal width".
 */

/** The bounds one side of the shell may be dragged between. */
export interface PanelBounds { min: number; max: number }

/*
 * The rail's floor is the width at which its rows are still readable.
 *
 * Raised from 200: below this the label had no room left after the active mark and the hover
 * action, and Chris's report was that names became unidentifiable when he narrowed it.
 */
export const RAIL_BOUNDS: PanelBounds = { min: 232, max: 400 };
export const STUDIO_BOUNDS: PanelBounds = { min: 280, max: 520 };

/** Holds a width inside its bounds; a missing or nonsense width falls back to `fallback`. */
export function clampPanelWidth(width: number | undefined, bounds: PanelBounds, fallback: number): number {
  const candidate = Number.isFinite(width) ? (width as number) : fallback;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(candidate)));
}

/**
 * The width a drag lands on.
 *
 * A left panel grows as the pointer moves right; a right panel grows as it moves left. Both
 * are clamped, so a fast drag past the edge parks at the bound instead of collapsing.
 */
export function widthFromDrag(
  side: 'left' | 'right',
  startWidth: number,
  deltaX: number,
  bounds: PanelBounds,
): number {
  const raw = side === 'left' ? startWidth + deltaX : startWidth - deltaX;
  return clampPanelWidth(raw, bounds, startWidth);
}
