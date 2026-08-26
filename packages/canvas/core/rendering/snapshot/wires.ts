import { pointAlong } from '../../domain/diagram-geometry.ts';
import { resolveWireAppearance } from '../wire-styles.ts';
import { wirePath } from '../wire-shape.ts';
import { planWireEndDecorations } from '../wire-end-decorations.ts';
import type { SnapshotScene } from './contract.ts';
import { escapeSvg } from './svg.ts';
import { emphasisLevel } from '../../domain/flows.ts';

/** Emits every internal wire beneath node cards using stable elbow geometry. */
export function renderSnapshotWires(scene: SnapshotScene): string[] {
  const parts: string[] = [];
  const boundaryById = new Map(
    scene.topology.boundaries.map((boundary) => [boundary.nodeId, boundary]),
  );
  for (const wire of scene.wires) {
    const plan = scene.routes[wire.id];
    if (!plan) continue;
    const points = plan.points.map((point) => ({
      x: point.x + scene.routeOffset.x,
      y: point.y + scene.routeOffset.y,
    }));
    const hint = scene.layout.wireRouteHints[wire.id];
    const label = pointAlong(points, hint?.labelPosition ?? 0.5);
    const authored = scene.layout.appearanceByWireId?.[wire.id];
    const appearance = resolveWireAppearance(wire.kind, authored, {
      theme: scene.theme, fallbackWidth: 1.4, fallbackShape: 'elbow',
    });
    const emphasis = scene.emphasis[wire.id];
    const level = emphasisLevel(emphasis);
    const decorations = planWireEndDecorations(
      points, wire.source.cardinality, wire.target.cardinality,
    );
    const crossings = scene.crossings.filter((crossing) => crossing.wireId === wire.id);
    const bypass = crossings.some((crossing) =>
      boundaryById.get(crossing.boundaryId)?.crossing === 'gated' && crossing.gateNodeId === null);
    const ordinaryStroke = crossings.length > 0 ? scene.style.colors.accent : appearance.strokeColor;
    const stroke = bypass ? scene.style.colors.danger
      : scene.activeFlowId && level === 2 ? scene.style.colors.accent
      : scene.activeFlowId && level === 0 ? scene.style.colors.faint : ordinaryStroke;
    const strokeWidth = scene.activeFlowId && level === 2 ? appearance.strokeWidth * 1.6
      : scene.activeFlowId && level === 0 ? appearance.strokeWidth * 0.8 : appearance.strokeWidth;
    const opacity = scene.activeFlowId && level === 0 ? ' opacity="0.3"' : '';
    const flowAttribute = scene.activeFlowId ? ` data-emphasis="${emphasis}"` : '';
    const customMarker = Boolean(authored || scene.activeFlowId);
    const markerId = customMarker ? `arrow-${String(wire.id).replaceAll(/[^a-zA-Z0-9_-]/g, '-')}` : 'arrow';
    if (customMarker && !decorations.notationMode) {
      parts.push(`<defs><marker id="${markerId}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${stroke}"/></marker></defs>`);
    }
    const classes = [crossings.length > 0 ? 'is-crossing' : '', bypass ? 'is-crossing-bypass' : '']
      .filter(Boolean).join(' ');
    parts.push(
      `<path${classes ? ` class="${classes}"` : ''}${flowAttribute} d="${wirePath(decorations.bodyPoints, appearance.shape)}" fill="none" stroke="${stroke}"${appearance.dashArray ? ` stroke-dasharray="${appearance.dashArray}"` : ''} stroke-width="${strokeWidth}"${opacity}${decorations.notationMode ? '' : ` marker-end="url(#${markerId})"`}/>`,
      ...decorations.lines.map((line) => `<line${flowAttribute} x1="${line.from.x}" y1="${line.from.y}" x2="${line.to.x}" y2="${line.to.y}" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity} stroke-linecap="round"/>`),
      ...decorations.circles.map((circle) => `<circle${flowAttribute} cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity}/>`),
      `<text${flowAttribute} x="${label.x}" y="${label.y - 6}" fill="${scene.activeFlowId && level === 2 ? scene.style.colors.accent : scene.style.colors.muted}"${opacity} font-family="${scene.style.font}" font-size="11" text-anchor="middle">${escapeSvg(wire.label)}</text>`,
    );
  }
  return parts;
}
