/**
 * `tree` nodes hold semantic hierarchy rows (`node.rows`, present only on this kind — every other
 * kind leaves it undefined). This component owns tree content (`content.ts`), its content-driven
 * size (`measure`), and its `./canvas snapshot` SVG body (`renderSvg`).
 */

import { orderedTreeRows, treeRowDepth, treeRowText } from './content.ts';
import { TREE_TONE_COLORS } from '../../presentation/wire-styles.ts';
import type { DiagramComponent } from '../component.ts';

const COLORS = { card: '#252529', ink: '#ececee', border: '#2f2f34' };
const FONT = 'Inter, sans-serif';

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export const treeComponent: DiagramComponent = {
  kind: 'tree',
  dslKeyword: 'tree',
  layoutRole: 'leaf',
  measure(node) {
    const rows = node.rows ?? [];
    const ordered = orderedTreeRows(rows);
    const longest = Math.max(0, ...ordered.map(
      (row) => treeRowDepth(rows, row) * 20 + treeRowText(row).length * 7.6,
    ));
    return {
      width: Math.min(640, Math.max(280, Math.round(36 + longest))),
      height: 56 + ordered.length * 24 + 14,
    };
  },
  renderSvg(node, box) {
    const { x, y, width, height } = box;
    const parts: string[] = [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.card}" stroke="${COLORS.border}" rx="6"/>`,
      `<text x="${x + 14}" y="${y + 24}" fill="${COLORS.ink}" font-family="${FONT}" font-size="13" font-weight="600">${esc(node.label)}</text>`,
    ];
    const rows = node.rows ?? [];
    orderedTreeRows(rows).forEach((row, index) => {
      const tone = row.kind === 'project' ? 'project'
        : row.kind === 'bucket' ? 'muted'
          : row.status === 'done' ? 'done'
            : row.status === 'in-progress' ? 'active'
              : row.status === 'todo' || row.status === 'retired' ? 'muted' : 'tombstone';
      const fill = TREE_TONE_COLORS[tone].dark;
      const rowX = x + 16 + treeRowDepth(rows, row) * 20;
      const weight = row.kind === 'project' || row.kind === 'bucket' ? ' font-weight="600"' : '';
      parts.push(`<text x="${rowX}" y="${y + 48 + index * 24}" fill="${fill}" font-family="SFMono-Regular, Consolas, monospace" font-size="11"${weight}>${esc(treeRowText(row))}</text>`);
    });
    return parts.join('\n');
  },
};
