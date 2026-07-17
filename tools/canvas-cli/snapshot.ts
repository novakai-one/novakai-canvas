/** Dependency-free SVG snapshot of one scope, in Novakai's dark + gold identity. */

import type { ArchitectureDocument } from '../../src/domain/model';

const COLORS = {
  page: '#0d0d0f',
  panel: '#1b1b1e',
  card: '#252529',
  ink: '#ececee',
  muted: '#a2a2aa',
  faint: '#8b8b94',
  gold: '#d0a14b',
  border: '#2f2f34',
};
const FONT = 'Inter, sans-serif';
const MARGIN = 24;

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(text: string, charsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > charsPerLine && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current.length > 0 ? `${current} ${word}` : word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function renderScopeSvg(doc: ArchitectureDocument, scopeId: string): string {
  const scope = doc.nodes[scopeId];
  if (!scope) throw new Error(`no scope "${scopeId}"`);
  const children = Object.values(doc.nodes)
    .filter((node) => node.parentId === scopeId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const childSet = new Set(children.map((node) => node.id));
  const wires = Object.values(doc.wires)
    .filter((wire) => childSet.has(wire.source) && childSet.has(wire.target))
    .sort((a, b) => a.id.localeCompare(b.id));

  const panel = { x: MARGIN, y: MARGIN, width: scope.size.width, height: scope.size.height };
  const total = { width: panel.width + 2 * MARGIN, height: panel.height + 2 * MARGIN };
  const abs = (id: string) => ({
    x: panel.x + doc.nodes[id].position.x,
    y: panel.y + doc.nodes[id].position.y,
  });

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total.width}" height="${total.height}" viewBox="0 0 ${total.width} ${total.height}">`,
    `<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${COLORS.faint}"/></marker></defs>`,
    `<rect x="0" y="0" width="${total.width}" height="${total.height}" fill="${COLORS.page}"/>`,
    `<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${COLORS.panel}" stroke="${COLORS.border}" rx="6"/>`,
    `<text x="${panel.x + 20}" y="${panel.y + 32}" fill="${COLORS.gold}" font-family="${FONT}" font-size="15" font-weight="600">${esc(scope.label)}</text>`,
  );

  // Wires under cards: elbow from source bottom-center to target top-center.
  for (const wire of wires) {
    const source = doc.nodes[wire.source];
    const target = doc.nodes[wire.target];
    const from = abs(wire.source);
    const to = abs(wire.target);
    const startX = from.x + source.size.width / 2;
    const startY = from.y + source.size.height;
    const endX = to.x + target.size.width / 2;
    const endY = to.y;
    const midY = startY + Math.max(16, (endY - startY) / 2);
    parts.push(
      `<polyline points="${startX},${startY} ${startX},${midY} ${endX},${midY} ${endX},${endY}" fill="none" stroke="${COLORS.faint}" stroke-width="1.4" marker-end="url(#arrow)"/>`,
      `<text x="${(startX + endX) / 2}" y="${midY - 6}" fill="${COLORS.muted}" font-family="${FONT}" font-size="11" text-anchor="middle">${esc(wire.label)}</text>`,
    );
  }

  for (const node of children) {
    const { x, y } = abs(node.id);
    const { width, height } = node.size;
    if (node.kind === 'comment') {
      parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${COLORS.border}" stroke-dasharray="4 4" rx="6"/>`);
      wrap(node.label, 34).forEach((line, index) => {
        parts.push(`<text x="${x + 14}" y="${y + 26 + index * 21}" fill="${COLORS.muted}" font-family="Georgia, serif" font-size="13" font-style="italic">${esc(line)}</text>`);
      });
      continue;
    }
    parts.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.card}" stroke="${COLORS.border}" rx="6"/>`,
      `<text x="${x + 14}" y="${y + 24}" fill="${COLORS.ink}" font-family="${FONT}" font-size="13" font-weight="600">${esc(node.label)}</text>`,
      `<text x="${x + width - 14}" y="${y + 24}" fill="${COLORS.muted}" font-family="${FONT}" font-size="9" text-anchor="end" letter-spacing="1">${esc(node.kind.toUpperCase())}</text>`,
    );
    let cursor = y + 44;
    if (node.description) {
      const charsPerLine = Math.max(30, Math.floor((width - 28) / 6.4));
      for (const line of wrap(node.description, charsPerLine)) {
        parts.push(`<text x="${x + 14}" y="${cursor}" fill="${COLORS.muted}" font-family="${FONT}" font-size="11">${esc(line)}</text>`);
        cursor += 16;
      }
      cursor += 8;
    }
    for (const interfaceId of node.interfaceIds) {
      const iface = doc.interfaces[interfaceId];
      const signature = `${iface.name}(${iface.accepts.join(', ')}) → ${iface.returns.join(', ')}`;
      parts.push(`<text x="${x + 14}" y="${cursor}" fill="${COLORS.ink}" font-family="${FONT}" font-size="12">${esc(signature)}</text>`);
      cursor += 26;
    }
    for (const typeId of node.typeIds) {
      const type = doc.types[typeId];
      parts.push(`<text x="${x + 14}" y="${cursor}" fill="${COLORS.faint}" font-family="${FONT}" font-size="11">${esc(`${type.name} { ${type.fields.join(', ')} }`)}</text>`);
      cursor += 24;
    }
  }

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}
