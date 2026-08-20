import { wireKindColor, wireKindDashArray } from '../../../src/presentation/wire-styles.ts';
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
    const stroke = wireKindColor(wire.kind, 'dark');
    const dash = wireKindDashArray(wire.kind);
    parts.push(
      `<polyline points="${startX},${startY} ${startX},${midY} ${endX},${midY} ${endX},${endY}" fill="none" stroke="${stroke}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-width="1.4" marker-end="url(#arrow)"/>`,
      `<text x="${(startX + endX) / 2}" y="${midY - 6}" fill="${SNAPSHOT_STYLE.colors.muted}" font-family="${SNAPSHOT_STYLE.font}" font-size="11" text-anchor="middle">${escapeSvg(wire.label)}</text>`,
    );
  }
  return parts;
}
