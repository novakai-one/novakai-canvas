import { pointAlong } from '../../../src/domain/diagram-geometry.ts';
import { resolveWireAppearance } from '../../../src/presentation/wire-styles.ts';
import { wirePath } from '../../../src/presentation/edges/wire-shape.ts';
import { planWireEndDecorations } from '../../../src/presentation/edges/wire-end-decorations.ts';
import type { SnapshotScene } from './contract.ts';
import { escapeSvg, SNAPSHOT_STYLE } from './svg.ts';

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
      theme: 'dark', fallbackWidth: 1.4, fallbackShape: 'elbow',
    });
    const decorations = planWireEndDecorations(
      points, wire.source.cardinality, wire.target.cardinality,
    );
    const crossings = scene.crossings.filter((crossing) => crossing.wireId === wire.id);
    const bypass = crossings.some((crossing) =>
      boundaryById.get(crossing.boundaryId)?.crossing === 'gated' && crossing.gateNodeId === null);
    const stroke = bypass ? SNAPSHOT_STYLE.colors.danger
      : crossings.length > 0 ? SNAPSHOT_STYLE.colors.gold : appearance.strokeColor;
    const markerId = authored ? `arrow-${String(wire.id).replaceAll(/[^a-zA-Z0-9_-]/g, '-')}` : 'arrow';
    if (authored && !decorations.notationMode) {
      parts.push(`<defs><marker id="${markerId}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${stroke}"/></marker></defs>`);
    }
    const classes = [crossings.length > 0 ? 'is-crossing' : '', bypass ? 'is-crossing-bypass' : '']
      .filter(Boolean).join(' ');
    parts.push(
      `<path${classes ? ` class="${classes}"` : ''} d="${wirePath(decorations.bodyPoints, appearance.shape)}" fill="none" stroke="${stroke}"${appearance.dashArray ? ` stroke-dasharray="${appearance.dashArray}"` : ''} stroke-width="${appearance.strokeWidth}"${decorations.notationMode ? '' : ` marker-end="url(#${markerId})"`}/>`,
      ...decorations.lines.map((line) => `<line x1="${line.from.x}" y1="${line.from.y}" x2="${line.to.x}" y2="${line.to.y}" stroke="${stroke}" stroke-width="${appearance.strokeWidth}" stroke-linecap="round"/>`),
      ...decorations.circles.map((circle) => `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" fill="none" stroke="${stroke}" stroke-width="${appearance.strokeWidth}"/>`),
      `<text x="${label.x}" y="${label.y - 6}" fill="${SNAPSHOT_STYLE.colors.muted}" font-family="${SNAPSHOT_STYLE.font}" font-size="11" text-anchor="middle">${escapeSvg(wire.label)}</text>`,
    );
  }
  return parts;
}
