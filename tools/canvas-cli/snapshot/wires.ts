import { pointAlong } from '../../../src/domain/diagram-geometry.ts';
import { resolveWireAppearance } from '../../../src/presentation/wire-styles.ts';
import { wirePath } from '../../../src/presentation/edges/wire-shape.ts';
import type { SnapshotScene } from './contract.ts';
import { escapeSvg, SNAPSHOT_STYLE } from './svg.ts';

/** Emits every internal wire beneath node cards using stable elbow geometry. */
export function renderSnapshotWires(scene: SnapshotScene): string[] {
  const parts: string[] = [];
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
    const markerId = authored ? `arrow-${String(wire.id).replaceAll(/[^a-zA-Z0-9_-]/g, '-')}` : 'arrow';
    if (authored) {
      parts.push(`<defs><marker id="${markerId}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${appearance.strokeColor}"/></marker></defs>`);
    }
    parts.push(
      `<path d="${wirePath(points, appearance.shape)}" fill="none" stroke="${appearance.strokeColor}"${appearance.dashArray ? ` stroke-dasharray="${appearance.dashArray}"` : ''} stroke-width="${appearance.strokeWidth}" marker-end="url(#${markerId})"/>`,
      `<text x="${label.x}" y="${label.y - 6}" fill="${SNAPSHOT_STYLE.colors.muted}" font-family="${SNAPSHOT_STYLE.font}" font-size="11" text-anchor="middle">${escapeSvg(wire.label)}</text>`,
    );
  }
  return parts;
}
