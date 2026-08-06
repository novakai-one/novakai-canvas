import { IconButton } from './panel-header';
import { useShellGeometry } from './shell-geometry';

/**
 * Closing a panel is the panel's own business; re-opening one is the canvas's.
 *
 * An open panel carries its close control in its own header (`PanelCollapse` below), which is
 * where a hand goes to look for it and is one fewer thing floating over the diagram. Once the
 * panel is gone that header is gone with it, so the edge keeps the way back — and only then.
 * A pair of permanent arrows on both seams was two marks earning nothing for the 99% of the
 * time both panels are open.
 *
 * Each glyph points where its panel is about to go.
 */
export function RailToggle() {
  const { railCollapsed, toggleRail } = useShellGeometry();
  if (!railCollapsed) return null;
  return (
    <div className="edge-toggle edge-toggle--rail">
      <IconButton glyph="⇥" label="Show diagrams" onClick={toggleRail} />
    </div>
  );
}

export function StudioToggle() {
  const { studioCollapsed, toggleStudio } = useShellGeometry();
  if (!studioCollapsed) return null;
  return (
    <div className="edge-toggle edge-toggle--studio">
      <IconButton glyph="⇤" label="Show studio" onClick={toggleStudio} />
    </div>
  );
}

/**
 * The close control an open panel wears in its own header.
 *
 * `side` names the panel, not the direction: the rail closes leftward and the studio
 * rightward, and the glyph says so.
 */
export function PanelCollapse({ side }: { side: 'left' | 'right' }) {
  const { toggleRail, toggleStudio } = useShellGeometry();
  return (
    <IconButton
      glyph={side === 'left' ? '⇤' : '⇥'}
      label={side === 'left' ? 'Hide diagrams' : 'Hide studio'}
      onClick={side === 'left' ? toggleRail : toggleStudio}
    />
  );
}
