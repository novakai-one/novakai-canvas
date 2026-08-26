import { componentFor } from '../../components/registry.ts';
import {
  resolveComponentPalette, type ComponentPaletteColors,
} from '../../components/component-palette.ts';
import { resolveNodeAppearance } from '../../domain/node-appearance.ts';
import type { DiagramRecord } from '../../../contract/records/index.ts';
import type { PlacedNode } from '../../authoring/records/record-graph.ts';
import type { SnapshotScene } from './contract.ts';
import { escapeSvg, SNAPSHOT_STYLE, wrapText } from './svg.ts';

/** Emits zone containers before cards so nested content remains visible above its boundary. */
export function renderSnapshotZones(scene: SnapshotScene): string[] {
  const parts: string[] = [];
  const { colors, font } = SNAPSHOT_STYLE;
  for (const zone of scene.descendants.filter((node) => node.kind === 'group')) {
    const { x, y } = scene.positionOf(zone.id as string);
    const { width, height } = zone.size;
    const dash = zone.label.startsWith('Standalone') ? ' stroke-dasharray="6 4"' : '';
    const boundary = scene.topology.boundaries.some((item) => item.nodeId === zone.id);
    parts.push(
      `<rect${boundary ? ' class="topology-boundary"' : ''} x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${boundary ? colors.gold : colors.border}"${dash} rx="6"/>`,
      `<text x="${x + 14}" y="${y + 22}" fill="${colors.gold}" font-family="${font}" font-size="12" font-weight="600">${escapeSvg(zone.label)}</text>`,
    );
  }
  return parts;
}

function renderComment(node: PlacedNode, x: number, y: number): string[] {
  const { colors } = SNAPSHOT_STYLE;
  const parts = [
    `<rect x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" fill="none" stroke="${colors.border}" stroke-dasharray="4 4" rx="6"/>`,
  ];
  wrapText(node.label, 34).forEach((line, index) => {
    parts.push(`<text x="${x + 14}" y="${y + 26 + index * 21}" fill="${colors.muted}" font-family="Georgia, serif" font-size="13" font-style="italic">${escapeSvg(line)}</text>`);
  });
  return parts;
}

function appendDescription(
  parts: string[], node: PlacedNode, x: number, cursor: number,
  palette?: ComponentPaletteColors,
): number {
  if (!node.description) return cursor;
  const charsPerLine = Math.max(30, Math.floor((node.size.width - 28) / 6.4));
  for (const line of wrapText(node.description, charsPerLine)) {
    parts.push(`<text x="${x + 14}" y="${cursor}" fill="${palette?.muted ?? SNAPSHOT_STYLE.colors.muted}" font-family="${SNAPSHOT_STYLE.font}" font-size="11">${escapeSvg(line)}</text>`);
    cursor += 16;
  }
  return cursor + 8;
}

function appendMembers(
  parts: string[],
  record: DiagramRecord,
  node: PlacedNode,
  x: number,
  cursor: number,
  palette?: ComponentPaletteColors,
): void {
  const { colors, font } = SNAPSHOT_STYLE;
  for (const interfaceId of node.interfaceIds) {
    const item = record.interfaces[interfaceId];
    const signature = `${item.name}(${item.accepts.join(', ')}) → ${item.returns.join(', ')}`;
    parts.push(`<text x="${x + 14}" y="${cursor}" fill="${palette?.text ?? colors.ink}" font-family="${font}" font-size="12">${escapeSvg(signature)}</text>`);
    cursor += 26;
  }
  for (const typeId of node.typeIds) {
    const item = record.types[typeId];
    parts.push(`<text x="${x + 14}" y="${cursor}" fill="${palette?.muted ?? colors.faint}" font-family="${font}" font-size="11">${escapeSvg(`${item.name} { ${item.fields.join(', ')} }`)}</text>`);
    cursor += 24;
  }
}

function renderFallbackCard(
  record: DiagramRecord,
  scene: SnapshotScene,
  node: PlacedNode,
  x: number,
  y: number,
): string[] {
  const { colors, font } = SNAPSHOT_STYLE;
  const appearance = resolveNodeAppearance(
    node.kind,
    scene.layout.appearanceByNodeId?.[node.id],
    { theme: 'dark', showKinds: true },
  );
  const custom = componentFor(node.kind).renderSvg?.(
    node, { x, y, width: node.size.width, height: node.size.height }, appearance,
  );
  if (custom !== undefined) return [custom];
  const palette = resolveComponentPalette(appearance.palette, appearance.theme, 'standard');
  const parts = [
    `<rect x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" fill="${palette?.surface ?? colors.card}" stroke="${palette?.frame ?? colors.border}" rx="6"/>`,
    ...(palette ? [`<path d="M${x + 1},${y + 6}Q${x + 1},${y + 1} ${x + 6},${y + 1}H${x + node.size.width - 6}Q${x + node.size.width - 1},${y + 1} ${x + node.size.width - 1},${y + 6}V${y + 42}H${x + 1}Z" fill="${palette.header}"/>`] : []),
    `<text x="${x + 14}" y="${y + 24}" fill="${palette?.headerText ?? colors.ink}" font-family="${font}" font-size="13" font-weight="600">${escapeSvg(node.label)}</text>`,
  ];
  if (appearance.showKindBadge) {
    parts.push(`<text x="${x + node.size.width - 14}" y="${y + 24}" fill="${palette?.headerMuted ?? colors.muted}" font-family="${font}" font-size="9" text-anchor="end" letter-spacing="1">${escapeSvg(node.kind.toUpperCase())}</text>`);
  }
  const cursor = appendDescription(parts, node, x, palette ? y + 52 : y + 44, palette);
  appendMembers(parts, record, node, x, cursor, palette);
  return parts;
}

/** Emits non-container descendants in preorder using component or shared card rendering. */
export function renderSnapshotNodes(record: DiagramRecord, scene: SnapshotScene): string[] {
  const parts: string[] = [];
  const gateIds = new Set(scene.topology.boundaries.flatMap((boundary) =>
    boundary.gate ? [boundary.gate as string] : []));
  for (const node of scene.descendants) {
    if (node.kind === 'group') continue;
    const { x, y } = scene.positionOf(node.id as string);
    parts.push(...(node.kind === 'comment'
      ? renderComment(node, x, y)
      : renderFallbackCard(record, scene, node, x, y)));
    if (gateIds.has(node.id as string)) {
      parts.push(
        `<circle class="topology-gate" cx="${x + node.size.width - 18}" cy="${y}" r="7" fill="${SNAPSHOT_STYLE.colors.page}" stroke="${SNAPSHOT_STYLE.colors.gold}" stroke-width="2"/>`,
      );
    }
  }
  return parts;
}
