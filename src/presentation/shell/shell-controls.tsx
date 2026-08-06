import { IconButton } from './panel-header';
import { useShellGeometry } from './shell-geometry';

/**
 * Each toggle sits on the edge it governs.
 *
 * They used to be a matched pair in the floating toolbar, mid-canvas and nowhere near either
 * panel — and Chris's review reported them as not existing at all. A control nobody can find is
 * a control that is not there, and the place to look for "close this panel" is the seam between
 * that panel and the canvas. So the rail's toggle rides the canvas's left edge and the studio's
 * its right, which is also the boundary that moves when either one opens.
 *
 * Each glyph still points where its panel is about to go: away to its own edge when open, back
 * toward the middle when closed.
 */
export function RailToggle() {
  const { railCollapsed, toggleRail } = useShellGeometry();
  return (
    <div className="edge-toggle edge-toggle--rail">
      <IconButton
        glyph={railCollapsed ? '⇥' : '⇤'}
        label={railCollapsed ? 'Show diagrams' : 'Hide diagrams'}
        onClick={toggleRail}
        pressed={railCollapsed}
      />
    </div>
  );
}

export function StudioToggle() {
  const { studioCollapsed, toggleStudio } = useShellGeometry();
  return (
    <div className="edge-toggle edge-toggle--studio">
      <IconButton
        glyph={studioCollapsed ? '⇤' : '⇥'}
        label={studioCollapsed ? 'Show studio' : 'Hide studio'}
        onClick={toggleStudio}
        pressed={studioCollapsed}
      />
    </div>
  );
}
