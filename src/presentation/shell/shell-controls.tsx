import { IconButton } from './panel-header';
import { useShellGeometry } from './shell-geometry';

/**
 * The matched pair that opens and closes the two edges.
 *
 * One pair, one place. A collapsed panel has no header to reach into, so the controls that
 * govern panel geometry live outside both panels, at the top of the workspace where the
 * reference build puts them. Each glyph points where its panel is about to go: away to its own
 * edge when open, back toward the middle when closed.
 */
export function ShellControls() {
  const { railCollapsed, studioCollapsed, toggleRail, toggleStudio } = useShellGeometry();
  return (
    <div className="shell-controls">
      <IconButton
        glyph={railCollapsed ? '⇥' : '⇤'}
        label={railCollapsed ? 'Show diagrams' : 'Hide diagrams'}
        onClick={toggleRail}
        pressed={railCollapsed}
      />
      <IconButton
        glyph={studioCollapsed ? '⇤' : '⇥'}
        label={studioCollapsed ? 'Show studio' : 'Hide studio'}
        onClick={toggleStudio}
        pressed={studioCollapsed}
      />
    </div>
  );
}
