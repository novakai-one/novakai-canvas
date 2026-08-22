/**
 * `tree` nodes hold semantic hierarchy rows (`node.rows`, present only on this kind — every other
 * kind leaves it undefined). This component owns tree content (`content.ts`), its content-driven
 * size (`measure`), and its `./canvas snapshot` SVG body (`renderSvg`).
 */

import { z } from 'zod';
import { orderedTreeRows, treeRowDepth, treeRowText } from './content.ts';
import { TREE_TONE_COLORS } from '../../presentation/wire-styles.ts';
import type { TreeRow } from '../../domain/model.ts';
import { namedNodeDeclaration, type ComponentItem, type DiagramComponent } from '../component.ts';

const COLORS = { card: '#252529', ink: '#ececee', border: '#2f2f34' };
const FONT = 'Inter, sans-serif';
const ROW_KINDS = new Set(['project', 'mission', 'task', 'bucket']);
const ROW_SHAPE = 'row <id> <project|mission|task|bucket> [status] [parent=<id>] [badges=a,b] [label "text"]';

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function treeItems(rows: TreeRow[]): ComponentItem[] {
  return rows.map((row) => {
    const parent = row.parentRowId ? rows.find((item) => item.id === row.parentRowId) : undefined;
    return {
      collection: 'rows',
      id: row.id,
      kind: row.kind,
      label: row.label ?? row.id,
      fields: [
        { label: 'Status', value: row.status ?? '—' },
        { label: 'Parent', value: parent ? parent.id : 'top level' },
        { label: 'Badges', value: row.badges.join(', ') || '—' },
      ],
    };
  });
}

export const treeComponent: DiagramComponent<'tree'> = {
  kind: 'tree',
  dslKeyword: 'tree',
  declaration: namedNodeDeclaration('tree', 'Delivery hierarchy'),
  resize: { minSize: { width: 240, height: 80 } },
  layoutRole: 'leaf',
  contentFields: {
    rows: z.array(z.object({
      id: z.string().min(1),
      kind: z.enum(['project', 'mission', 'task', 'bucket']),
      status: z.string().optional(),
      parentRowId: z.string().optional(),
      badges: z.array(z.string()),
      label: z.string().optional(),
    })).optional(),
  },
  items(node) {
    return treeItems(node.rows ?? []);
  },
  dslChildren: [{
    keyword: 'row',
    syntax: ROW_SHAPE,
    example: 'row project-1 project active label "Project One"',
    contentKey: 'rows',
    parse(tokens) {
      if (tokens.length < 3) {
        return {
          error: 'row needs an id and a kind',
          hint: 'row mission_x mission [status] [parent=<id>] [badges=a,b] [label "text"]',
        };
      }
      if (!ROW_KINDS.has(tokens[2])) {
        return { error: `unknown row kind "${tokens[2]}"`, hint: `use one of: ${[...ROW_KINDS].join(', ')}` };
      }
      const row: TreeRow = { id: tokens[1], kind: tokens[2] as TreeRow['kind'], badges: [] };
      for (let index = 3; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (token === 'label' && tokens[index + 1] !== undefined) {
          row.label = tokens[(index += 1)];
        } else if (token.startsWith('parent=')) {
          row.parentRowId = token.slice('parent='.length);
        } else if (token.startsWith('badges=')) {
          row.badges = token.slice('badges='.length).split(',').filter((badge) => badge.length > 0);
        } else if (row.status === undefined && !token.includes('=')) {
          row.status = token;
        } else {
          return { error: `unexpected "${token}" in row`, hint: ROW_SHAPE };
        }
      }
      return { content: row };
    },
    print(node) {
      return (node.rows ?? []).map((row) => `  row ${row.id} ${row.kind}`
        + `${row.status ? ` ${row.status}` : ''}`
        + `${row.parentRowId ? ` parent=${row.parentRowId}` : ''}`
        + `${row.badges.length > 0 ? ` badges=${row.badges.join(',')}` : ''}`
        + `${row.label ? ` label "${row.label}"` : ''}`);
    },
  }],
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
