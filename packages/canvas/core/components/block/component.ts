/** Registry-owned multiline text block with deterministic measurement and SVG output. */

import type { CanvasNode } from '../../../contract/records/index.ts';
import {
  BLOCK_WIRE_REF as WIRE_REF, nodeContentFields,
} from '../../../contract/schemas/content.ts';
import type { DiagramComponent, DslNodeDeclaration } from '../component.ts';
import { GLYPHS } from '../glyphs.ts';
import { layoutBlockText, measureBlockTextWidth } from './text-layout.ts';

const SYNTAX = 'block "label" [ref=kebab-case] [icon=check|clock|people|shield|target|trend font=… size=… weight=… align=… vertical-align=… text=… background=… border-color=… border=… radius=… padding=…]';
const EXAMPLE = 'block "Refusal rate" ref=refusal-rate icon=target size=14 weight=600 align=center vertical-align=center text=green border-color=green border=1 radius=8 padding=12';

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const declaration: DslNodeDeclaration = {
  syntax: SYNTAX,
  example: EXAMPLE,
  allowsBody: true,
  parse(tokens) {
    if (!tokens[1] || tokens.length > 3) return { error: 'block needs one non-empty label and optional ref=name', hint: EXAMPLE };
    if (!tokens[2]) return { label: tokens[1] };
    if (!tokens[2].startsWith('ref=')) return { error: `unknown block attribute "${tokens[2].split('=')[0]}"`, hint: EXAMPLE };
    const wireRef = tokens[2].slice(4);
    if (!WIRE_REF.test(wireRef)) {
      return { error: `invalid block ref "${wireRef}"`, hint: 'use ref=name in lowercase kebab-case, 1–64 characters' };
    }
    return { label: tokens[1], content: { wireRef } };
  },
  print(node) {
    return `block "${node.label}"${node.wireRef ? ` ref=${node.wireRef}` : ''}`;
  },
};

export const blockComponent: DiagramComponent<'block'> = {
  kind: 'block',
  dslKeyword: 'block',
  declaration,
  creation: {
    category: 'text', label: 'Text block', hint: 'Styled multiline content',
    defaultLabel: 'New block', initialSize: { width: 280, height: 140 },
    initialSizeMode: 'manual',
    stableIdField: 'wireRef',
  },
  resize: { minSize: { width: 80, height: 40 } },
  layoutRole: 'leaf',
  allowsMembers: false,
  identity: {
    scope: 'parent',
    namespace: 'block',
    keyField: 'wireRef',
    wireAddress: { field: 'wireRef' },
    preserveDeclarationOrder: true,
  },
  appearanceKeys: [
    'icon', 'font', 'size', 'weight', 'align', 'vertical-align', 'text', 'background',
    'border-color', 'border', 'radius', 'padding',
  ],
  contentFields: nodeContentFields('block'),
  contentEditors: [{ field: 'lines', kind: 'string-list', label: 'Content', itemLabel: 'Line' }],
  dslChildren: [{
    keyword: 'line',
    syntax: 'line "non-empty text"',
    example: 'line "• Safety"',
    contentKey: 'lines',
    parse(tokens) {
      if (!tokens[1] || tokens.length !== 2) {
        return { error: 'line needs one non-empty text value', hint: 'line "• Safety"' };
      }
      return { content: tokens[1] };
    },
    print(node) {
      return (node.lines ?? []).map((line) => `  line "${line}"`);
    },
  }],
  measure(node, context) {
    return layoutBlockText(node.label, node.lines ?? [], context.appearance).size;
  },
  renderSvg(node: CanvasNode, box, appearance) {
    const layout = layoutBlockText(node.label, node.lines ?? [], appearance);
    const inset = appearance.padding + appearance.borderWidth;
    const anchor = appearance.textAlign === 'left' ? 'start'
      : appearance.textAlign === 'right' ? 'end' : 'middle';
    const x = appearance.textAlign === 'left' ? box.x + inset
      : appearance.textAlign === 'right' ? box.x + box.width - inset : box.x + box.width / 2;
    const lineHeight = appearance.fontSize * 1.4;
    const availableHeight = Math.max(0, box.height - inset * 2);
    const verticalOffset = appearance.verticalAlign === 'center'
      ? Math.max(0, (availableHeight - layout.contentHeight) / 2)
      : appearance.verticalAlign === 'bottom'
        ? Math.max(0, availableHeight - layout.contentHeight)
        : 0;
    const contentTop = box.y + inset + verticalOffset;
    const parts = [
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${appearance.backgroundColor}" stroke="${appearance.borderColor}" stroke-width="${appearance.borderWidth}" rx="${appearance.borderRadius}"/>`,
    ];
    let firstTextX = x;
    if (appearance.icon) {
      const firstLineWidth = measureBlockTextWidth(layout.lines[0] ?? '', appearance);
      const firstRowWidth = layout.iconSize + layout.iconGap + firstLineWidth;
      const rowX = appearance.textAlign === 'left' ? box.x + inset
        : appearance.textAlign === 'right' ? box.x + box.width - inset - firstRowWidth
          : box.x + (box.width - firstRowWidth) / 2;
      const iconY = contentTop + (layout.firstRowHeight - layout.iconSize) / 2;
      firstTextX = rowX + layout.iconSize + layout.iconGap;
      parts.push(`<g data-icon="${appearance.icon}" transform="translate(${rowX} ${iconY}) scale(${layout.iconSize / 24})" fill="none" stroke="${appearance.textColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>${appearance.icon} icon</title><path d="${GLYPHS[appearance.icon]}"/></g>`);
    }
    layout.lines.forEach((line, index) => {
      const y = appearance.icon
        ? (index === 0
            ? contentTop + (layout.firstRowHeight - lineHeight) / 2 + appearance.fontSize
            : contentTop + layout.firstRowHeight + (index - 1) * lineHeight + appearance.fontSize)
        : contentTop + appearance.fontSize + index * lineHeight;
      const lineX = index === 0 && appearance.icon ? firstTextX : x;
      const lineAnchor = index === 0 && appearance.icon ? 'start' : anchor;
      parts.push(`<text x="${lineX}" y="${y}" fill="${appearance.textColor}" font-family="${escapeXml(appearance.fontFamily)}" font-size="${appearance.fontSize}" font-weight="${appearance.fontWeight}" text-anchor="${lineAnchor}" xml:space="preserve">${escapeXml(line)}</text>`);
    });
    return parts.join('\n');
  },
};

export { layoutBlockText } from './text-layout.ts';
