import type { CanvasPreferences, WireKind } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import { WIRE_KIND_STYLES, wireKindColorVariable, wireKindDashArray } from '../wire-styles';

interface LegendProps {
  view: ProjectedView;
  preferences: CanvasPreferences;
  activeFlowName?: string;
}

/** Quiet overlay explaining only the wire kinds the visible diagram actually uses. */
export function Legend({ activeFlowName, preferences, view }: LegendProps) {
  if (!preferences.canvas.showLegend) return null;
  const present = new Set<string>(view.wires.map((wire) => wire.kind));
  const kinds = (Object.keys(WIRE_KIND_STYLES) as WireKind[]).filter((kind) => present.has(kind));
  const standalone = view.nodes
    .some((node) => node.kind === 'group' && node.label.startsWith('Standalone'));
  if (kinds.length === 0 && !standalone && !activeFlowName) return null;
  return (
    <aside className="canvas-legend" aria-label="Wire kinds">
      {activeFlowName && <div className="legend-flow">Flow: {activeFlowName}</div>}
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
      {standalone && (
        <div className="legend-row">
          <svg aria-hidden height="10" width="34">
            <rect fill="none" height="8" stroke="var(--faint)" strokeDasharray="3 2" strokeWidth="1.2" width="32" x="1" y="1" />
          </svg>
          <span>dashed container = standalone</span>
        </div>
      )}
    </aside>
  );
}
