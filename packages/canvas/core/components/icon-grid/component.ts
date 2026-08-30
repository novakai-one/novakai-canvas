/**
 * An icon grid is one titled panel of icon-with-caption cells drawn from the shared closed
 * icon vocabulary. Items are content addressed by position — they carry no stored identity,
 * which is why the component declares the index-keyed `item-list` editor.
 */

import { ICON_NAMES, type IconGridItem } from '../../../contract/records/components.ts';
import type { CanvasNode } from '../../../contract/records/index.ts';
import { ICON_GRID_ITEM_LIMIT, nodeContentFields } from '../../../contract/schemas/content.ts';
import type { DiagramComponent, DslNodeDeclaration } from '../component.ts';
import { GLYPHS } from '../glyphs.ts';

const ICON_LIST = ICON_NAMES.join('|');
const SYNTAX = 'icon-grid "title"';
const ITEM_SYNTAX = `item icon=${ICON_LIST} "caption"`;
const ITEM_EXAMPLE = 'item icon=brain "LLM"';

const COLORS = { card: '#252529', ink: '#ececee', border: '#2f2f34', muted: '#9a9aa2', accent: '#d0a14b' };
const FONT = 'Inter, sans-serif';
const PADDING = 16;
const HEADER = 30;
const CELL_HEIGHT = 56;
const CELL_GAP = 12;
const ICON_SIZE = 24;

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function items(node: CanvasNode): readonly IconGridItem[] {
  return node.iconItems ?? [];
}

/** Up to three cells sit in one row; four or more split into two balanced rows. */
export function iconGridColumns(count: number): number {
  return count <= 3 ? Math.max(1, count) : Math.ceil(count / 2);
}

function cellWidth(gridItems: readonly IconGridItem[]): number {
  const longest = gridItems.reduce((width, item) => Math.max(width, item.caption.length), 0);
  return Math.max(72, Math.round(longest * 6.4) + 16);
}

const declaration: DslNodeDeclaration = {
  syntax: SYNTAX,
  example: 'icon-grid "What the harness provides"',
  allowsBody: true,
  parse(tokens) {
    if (!tokens[1] || tokens.length !== 2) {
      return { error: 'icon-grid needs one non-empty title', hint: SYNTAX };
    }
    return { label: tokens[1] };
  },
  print(node) {
    return `icon-grid "${node.label}"`;
  },
};

export const iconGridComponent: DiagramComponent<'icon-grid'> = {
  kind: 'icon-grid',
  dslKeyword: 'icon-grid',
  declaration,
  creation: {
    category: 'text', label: 'Icon grid', hint: 'Icons with captions',
    defaultLabel: 'New icon grid', initialSize: { width: 280, height: 150 },
  },
  resize: { minSize: { width: 160, height: 100 } },
  layoutRole: 'leaf',
  allowsMembers: false,
  contentFields: nodeContentFields('icon-grid'),
  contentEditors: [{
    field: 'iconItems',
    kind: 'item-list',
    label: 'Items',
    itemLabel: 'Item',
    maxItems: ICON_GRID_ITEM_LIMIT,
    defaults: { icon: 'check', caption: 'New item' },
    fields: [
      { field: 'icon', label: 'Icon', control: 'select', values: ICON_NAMES, required: true },
      { field: 'caption', label: 'Caption', control: 'text', required: true },
    ],
  }],
  dslChildren: [{
    keyword: 'item',
    syntax: ITEM_SYNTAX,
    example: ITEM_EXAMPLE,
    contentKey: 'iconItems',
    parse(tokens) {
      const attribute = tokens[1] ?? '';
      const caption = tokens[2];
      if (!attribute.startsWith('icon=') || !caption || tokens.length !== 3) {
        return { error: 'item needs icon=<name> and one non-empty caption', hint: ITEM_EXAMPLE };
      }
      const icon = ICON_NAMES.find((name) => name === attribute.slice('icon='.length));
      if (!icon) {
        return { error: `unknown icon "${attribute.slice('icon='.length)}"; use one of: ${ICON_LIST}`, hint: ITEM_EXAMPLE };
      }
      return { content: { icon, caption } };
    },
    validate(_content, existingSiblings) {
      if (existingSiblings.length < ICON_GRID_ITEM_LIMIT) return undefined;
      return { error: `icon-grid carries at most ${ICON_GRID_ITEM_LIMIT} items`, hint: ITEM_EXAMPLE };
    },
    print(node) {
      return items(node).map((item) => `  item icon=${item.icon} "${item.caption}"`);
    },
  }],
  measure(node) {
    const gridItems = items(node);
    const columns = iconGridColumns(gridItems.length);
    const rows = Math.max(1, Math.ceil(gridItems.length / columns));
    const width = PADDING * 2 + columns * cellWidth(gridItems) + (columns - 1) * CELL_GAP;
    const height = PADDING + HEADER + rows * CELL_HEIGHT + (rows - 1) * CELL_GAP + PADDING;
    return { width: Math.max(200, width), height };
  },
  renderSvg(node: CanvasNode, box) {
    const gridItems = items(node);
    const columns = iconGridColumns(gridItems.length);
    const width = cellWidth(gridItems);
    const parts = [
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${COLORS.card}" stroke="${COLORS.border}" rx="6"/>`,
      `<text x="${box.x + PADDING}" y="${box.y + PADDING + 8}" fill="${COLORS.ink}" font-family="${FONT}" font-size="13" font-weight="600">${esc(node.label)}</text>`,
    ];
    gridItems.forEach((item, index) => {
      const cellX = box.x + PADDING + (index % columns) * (width + CELL_GAP);
      const cellY = box.y + PADDING + HEADER + Math.floor(index / columns) * (CELL_HEIGHT + CELL_GAP);
      const iconX = cellX + (width - ICON_SIZE) / 2;
      parts.push(
        `<g data-icon="${item.icon}" transform="translate(${iconX} ${cellY})" fill="none" stroke="${COLORS.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>${item.icon} icon</title><path d="${GLYPHS[item.icon]}"/></g>`,
        `<text x="${cellX + width / 2}" y="${cellY + ICON_SIZE + 16}" fill="${COLORS.muted}" font-family="${FONT}" font-size="11" text-anchor="middle">${esc(item.caption)}</text>`,
      );
    });
    return parts.join('\n');
  },
};
