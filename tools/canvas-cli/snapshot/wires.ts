import { resolveWireAppearance } from '../../../src/presentation/wire-styles.ts';
import type { SnapshotScene } from './contract.ts';
import { escapeSvg, SNAPSHOT_STYLE } from './svg.ts';

/** Emits every internal wire beneath node cards using stable elbow geometry. */
export function renderSnapshotWires(scene: SnapshotScene): string[] {
  const parts: string[] = [];
  for (const wire of scene.wires) {
    const source = scene.nodes[wire.source.nodeId];
    const target = scene.nodes[wire.target.nodeId];
    const from = scene.positionOf(wire.source.nodeId as string);
    const to = scene.positionOf(wire.target.nodeId as string);
    const startX = from.x + source.size.width / 2;
    const startY = from.y + source.size.height;
    const endX = to.x + target.size.width / 2;
    const endY = to.y;
    const midY = startY + Math.max(16, (endY - startY) / 2);
    const authored = scene.layout.appearanceByWireId?.[wire.id];
    const appearance = resolveWireAppearance(wire.kind, authored, { theme: 'dark', fallbackWidth: 1.4 });
    const markerId = authored ? `arrow-${String(wire.id).replaceAll(/[^a-zA-Z0-9_-]/g, '-')}` : 'arrow';
    if (authored) {
      parts.push(`<defs><marker id="${markerId}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${appearance.strokeColor}"/></marker></defs>`);
    }
    parts.push(
      `<polyline points="${startX},${startY} ${startX},${midY} ${endX},${midY} ${endX},${endY}" fill="none" stroke="${appearance.strokeColor}"${appearance.dashArray ? ` stroke-dasharray="${appearance.dashArray}"` : ''} stroke-width="${appearance.strokeWidth}" marker-end="url(#${markerId})"/>`,
      `<text x="${(startX + endX) / 2}" y="${midY - 6}" fill="${SNAPSHOT_STYLE.colors.muted}" font-family="${SNAPSHOT_STYLE.font}" font-size="11" text-anchor="middle">${escapeSvg(wire.label)}</text>`,
    );
  }
  return parts;
}
