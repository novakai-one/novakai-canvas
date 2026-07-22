import type { ArchitectureDocument, CanvasPreferences, WireKind } from '../../domain/model';
import { WIRE_KIND_STYLES, wireKindColorVariable, wireKindDashArray } from '../wire-styles';

interface LegendProps {
  document: ArchitectureDocument;
  preferences: CanvasPreferences;
}

/** Quiet overlay explaining only the wire kinds the active map actually uses. */
export function Legend({ document, preferences }: LegendProps) {
  if (!preferences.canvas.showLegend) return null;
  const present = new Set(Object.values(document.wires).map((wire) => wire.kind));
  const kinds = (Object.keys(WIRE_KIND_STYLES) as WireKind[]).filter((kind) => present.has(kind));
  if (kinds.length === 0) return null;
  return (
    <aside className="canvas-legend" aria-label="Wire kinds">
      {kinds.map((kind) => (
        <div className="legend-row" key={kind}>
          <svg aria-hidden height="10" width="34">
            <line
              stroke={wireKindColorVariable(kind)}
              strokeDasharray={wireKindDashArray(kind) || undefined}
              strokeWidth="1.6"
              x1="1" x2="33" y1="5" y2="5"
            />
          </svg>
          <span>{WIRE_KIND_STYLES[kind].legend}</span>
        </div>
      ))}
    </aside>
  );
}
