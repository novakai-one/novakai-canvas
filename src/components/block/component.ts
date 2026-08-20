/** Registry-owned multiline text block with deterministic measurement and SVG output. */

import { z } from 'zod';
import type { ResolvedNodeAppearance } from '../../domain/canvas-presentation.ts';
import type { CanvasNode } from '../../domain/records.ts';
import type { DiagramComponent, DslNodeDeclaration, Size } from '../component.ts';
import { GLYPHS } from '../glyphs.ts';

const MAX_CONTENT_WIDTH = 320;
const ICON_GAP = 8;
const SYNTAX = 'block "label" [icon=check|clock|people|shield|target|trend font=… size=… weight=… align=… text=… background=… border-color=… border=… radius=… padding=…]';
const EXAMPLE = 'block "Refusal rate" icon=target size=14 weight=600 align=center text=green border-color=green border=1 radius=8 padding=12';

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Conservative cross-host text width; renderers consume its lines instead of wrapping again. */
function textWidth(text: string, appearance: ResolvedNodeAppearance): number {
  const familyFactor = appearance.font === 'mono' ? 0.64 : appearance.font === 'serif' ? 0.62 : 0.61;
  const weightFactor = appearance.fontWeight >= 600 ? 1.035 : 1;
  let units = 0;
  for (const character of text) {
    if (/\s/.test(character)) units += 0.38;
    else if (/[ilI.,:;'|!]/.test(character)) units += 0.36;
    else if (/[MW@#%&]/.test(character)) units += 0.92;
    else if (character.codePointAt(0)! > 0x7f) units += 0.78;
    else units += familyFactor;
  }
  return units * appearance.fontSize * weightFactor;
}

function breakToken(token: string, width: number, appearance: ResolvedNodeAppearance): string[] {
  const parts: string[] = [];
  let current = '';
  for (const character of token) {
    if (current && textWidth(`${current}${character}`, appearance) > width) {
      parts.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(text: string, width: number, appearance: ResolvedNodeAppearance): string[] {
  if (textWidth(text, appearance) <= width) return [text];
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const pieces = textWidth(word, appearance) > width ? breakToken(word, width, appearance) : [word];
    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (current && textWidth(candidate, appearance) > width) {
        lines.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** The one wrap and size authority shared by automatic layout, React, and SVG. */
export function layoutBlockText(
  label: string,
  authoredLines: readonly string[],
  appearance: ResolvedNodeAppearance,
): {
  size: Size;
  lines: readonly string[];
  iconSize: number;
  iconGap: number;
  firstRowHeight: number;
} {
  const sourceLines = [label, ...authoredLines];
  const iconSize = appearance.icon ? Math.round(appearance.fontSize * 1.3) : 0;
  const iconWidth = iconSize === 0 ? 0 : iconSize + ICON_GAP;
  const contentWidth = Math.max(1, Math.min(
    MAX_CONTENT_WIDTH,
    Math.ceil(Math.max(
      textWidth(label, appearance) + iconWidth,
      ...authoredLines.map((line) => textWidth(line, appearance)),
    )),
  ));
  const lines = [
    ...wrapText(label, Math.max(1, contentWidth - iconWidth), appearance),
    ...sourceLines.slice(1).flatMap((line) => wrapText(line, contentWidth, appearance)),
  ];
  const lineHeight = appearance.fontSize * 1.4;
  const firstRowHeight = Math.max(lineHeight, iconSize);
  const inset = appearance.padding + appearance.borderWidth;
  return {
    size: {
      width: Math.ceil(contentWidth + inset * 2),
      height: Math.ceil(firstRowHeight + Math.max(0, lines.length - 1) * lineHeight + inset * 2),
    },
    lines,
    iconSize,
    iconGap: iconSize === 0 ? 0 : ICON_GAP,
    firstRowHeight,
  };
}

const declaration: DslNodeDeclaration = {
  syntax: SYNTAX,
  example: EXAMPLE,
  allowsBody: true,
  parse(tokens) {
    if (!tokens[1] || tokens.length !== 2) return { error: 'block needs one non-empty label', hint: EXAMPLE };
    return { label: tokens[1] };
  },
  print(node) {
    return `block "${node.label}"`;
  },
};

export const blockComponent: DiagramComponent<'block'> = {
  kind: 'block',
  dslKeyword: 'block',
  declaration,
  layoutRole: 'leaf',
  allowsMembers: false,
  identity: {
    scope: 'parent',
    namespace: 'block',
    wireEndpoint: false,
    preserveDeclarationOrder: true,
  },
  appearanceKeys: [
    'icon', 'font', 'size', 'weight', 'align', 'text', 'background',
    'border-color', 'border', 'radius', 'padding',
  ],
  contentFields: { lines: z.array(z.string().min(1)).optional() },
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
    const parts = [
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${appearance.backgroundColor}" stroke="${appearance.borderColor}" stroke-width="${appearance.borderWidth}" rx="${appearance.borderRadius}"/>`,
    ];
    let firstTextX = x;
    if (appearance.icon) {
      const firstLineWidth = textWidth(layout.lines[0] ?? '', appearance);
      const firstRowWidth = layout.iconSize + layout.iconGap + firstLineWidth;
      const rowX = appearance.textAlign === 'left' ? box.x + inset
        : appearance.textAlign === 'right' ? box.x + box.width - inset - firstRowWidth
          : box.x + (box.width - firstRowWidth) / 2;
      const iconY = box.y + inset + (layout.firstRowHeight - layout.iconSize) / 2;
      firstTextX = rowX + layout.iconSize + layout.iconGap;
      parts.push(`<g data-icon="${appearance.icon}" transform="translate(${rowX} ${iconY}) scale(${layout.iconSize / 24})" fill="none" stroke="${appearance.textColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>${appearance.icon} icon</title><path d="${GLYPHS[appearance.icon]}"/></g>`);
    }
    layout.lines.forEach((line, index) => {
      const y = appearance.icon
        ? (index === 0
            ? box.y + inset + (layout.firstRowHeight - lineHeight) / 2 + appearance.fontSize
            : box.y + inset + layout.firstRowHeight + (index - 1) * lineHeight + appearance.fontSize)
        : box.y + inset + appearance.fontSize + index * lineHeight;
      const lineX = index === 0 && appearance.icon ? firstTextX : x;
      const lineAnchor = index === 0 && appearance.icon ? 'start' : anchor;
      parts.push(`<text x="${lineX}" y="${y}" fill="${appearance.textColor}" font-family="${escapeXml(appearance.fontFamily)}" font-size="${appearance.fontSize}" font-weight="${appearance.fontWeight}" text-anchor="${lineAnchor}" xml:space="preserve">${escapeXml(line)}</text>`);
    });
    return parts.join('\n');
  },
};
