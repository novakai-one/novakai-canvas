/**
 * An icon card is one message with artwork chosen from a fixed semantic vocabulary. This pure
 * component owns that vocabulary, the shared glyph paths, DSL, validation, size, and snapshot.
 */

import { z } from 'zod';
import type { IconCardIcon } from '../../domain/component-content.ts';
import type { CanvasNode } from '../../domain/records.ts';
import type { DslNodeDeclaration, DiagramComponent } from '../component.ts';
import { GLYPHS, GLYPH_NAMES } from '../glyphs.ts';

export const ICON_CARD_ICONS = GLYPH_NAMES;
const ICON_LIST = ICON_CARD_ICONS.join('|');
const SYNTAX = `icon-card "title" icon=${ICON_LIST} description="text"`;
const EXAMPLE = 'icon-card "Automated checks" icon=check description="Every change is verified."';

/** Compatibility exports; the shared glyph module owns the values. */
export const ICON_CARD_PATHS = GLYPHS;

const COLORS = { card: '#252529', ink: '#ececee', border: '#2f2f34', muted: '#9a9aa2', accent: '#d0a14b' };
const FONT = 'Inter, sans-serif';

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function assignment(
  tokens: string[],
  index: number,
): { key: string; value: string; next: number } | undefined {
  const token = tokens[index];
  const equals = token.indexOf('=');
  if (equals === -1) return undefined;
  const key = token.slice(0, equals);
  const inline = token.slice(equals + 1);
  if (inline) return { key, value: inline, next: index + 1 };
  const value = tokens[index + 1];
  return { key, value: value ?? '', next: value === undefined ? index + 1 : index + 2 };
}

const declaration: DslNodeDeclaration = {
  syntax: SYNTAX,
  example: EXAMPLE,
  allowsBody: false,
  parse(tokens) {
    const label = tokens[1];
    if (!label || label.includes('=')) return { error: 'icon-card needs a title', hint: EXAMPLE };

    const fields: Record<string, string> = {};
    for (let index = 2; index < tokens.length;) {
      const field = assignment(tokens, index);
      if (!field || !['icon', 'description'].includes(field.key)) {
        return { error: `unexpected "${tokens[index]}" in icon-card`, hint: SYNTAX };
      }
      if (field.key in fields) return { error: `icon-card repeats ${field.key}`, hint: SYNTAX };
      if (!field.value) return { error: `icon-card ${field.key} cannot be empty`, hint: SYNTAX };
      fields[field.key] = field.value;
      index = field.next;
    }

    if (!fields.icon) return { error: `icon-card needs icon=${ICON_LIST}`, hint: SYNTAX };
    if (!ICON_CARD_ICONS.includes(fields.icon as IconCardIcon)) {
      return { error: `unknown icon "${fields.icon}"; use one of: ${ICON_LIST}`, hint: SYNTAX };
    }
    if (!fields.description) return { error: 'icon-card needs description="text"', hint: SYNTAX };
    return { label, description: fields.description, content: { icon: fields.icon } };
  },
  print(node) {
    return `icon-card "${node.label}" icon=${node.icon ?? 'check'} description="${node.description ?? ''}"`;
  },
};

export const iconCardComponent: DiagramComponent<'icon-card'> = {
  kind: 'icon-card',
  dslKeyword: 'icon-card',
  declaration,
  resize: { minSize: { width: 240, height: 104 } },
  layoutRole: 'leaf',
  contentFields: {
    icon: z.enum(ICON_CARD_ICONS),
    description: z.string().min(1),
  },
  measure(node) {
    const longest = Math.max(node.label.length, node.description?.length ?? 0);
    return { width: Math.min(380, Math.max(240, 104 + Math.round(6.4 * longest))), height: 120 };
  },
  renderSvg(node: CanvasNode, box) {
    const { x, y, width, height } = box;
    const icon = node.icon ?? 'check';
    return [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.card}" stroke="${COLORS.border}" rx="6"/>`,
      `<rect x="${x + 16}" y="${y + 20}" width="44" height="44" fill="none" stroke="${COLORS.border}" rx="6"/>`,
      `<g data-icon="${icon}" transform="translate(${x + 26} ${y + 30})" fill="none" stroke="${COLORS.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>${icon} icon</title><path d="${ICON_CARD_PATHS[icon]}"/></g>`,
      `<text x="${x + 76}" y="${y + 35}" fill="${COLORS.ink}" font-family="${FONT}" font-size="13" font-weight="600">${esc(node.label)}</text>`,
      `<text x="${x + 76}" y="${y + 57}" fill="${COLORS.muted}" font-family="${FONT}" font-size="11">${esc(node.description ?? '')}</text>`,
      `<text x="${x + 16}" y="${y + height - 14}" fill="${COLORS.muted}" font-family="${FONT}" font-size="9">${esc(icon.toUpperCase())}</text>`,
    ].join('\n');
  },
};
