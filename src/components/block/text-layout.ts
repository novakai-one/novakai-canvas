/** Deterministic text measurement and wrapping shared by block renderers. */

import type { ResolvedNodeAppearance } from '../../domain/canvas-presentation.ts';
import type { Size } from '../component.ts';

const MAX_CONTENT_WIDTH = 320;
const ICON_GAP = 8;

/** Conservative cross-host text width; renderers consume its lines instead of wrapping again. */
export function measureBlockTextWidth(text: string, appearance: ResolvedNodeAppearance): number {
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
    if (current && measureBlockTextWidth(`${current}${character}`, appearance) > width) {
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
  if (measureBlockTextWidth(text, appearance) <= width) return [text];
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const pieces = measureBlockTextWidth(word, appearance) > width
      ? breakToken(word, width, appearance)
      : [word];
    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (current && measureBlockTextWidth(candidate, appearance) > width) {
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
      measureBlockTextWidth(label, appearance) + iconWidth,
      ...authoredLines.map((line) => measureBlockTextWidth(line, appearance)),
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
