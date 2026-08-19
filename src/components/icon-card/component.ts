/**
 * An icon card is one message with artwork chosen from a fixed semantic vocabulary. This pure
 * component owns that vocabulary, the shared glyph paths, DSL, validation, size, and snapshot.
 */

import { z } from 'zod';
import type { IconCardIcon } from '../../domain/model.ts';
import type { CanvasNode } from '../../domain/records.ts';
import type { DslNodeDeclaration, DiagramComponent } from '../component.ts';

export const ICON_CARD_ICONS = ['check', 'clock', 'people', 'shield', 'target', 'trend'] as const;
const ICON_LIST = ICON_CARD_ICONS.join('|');
const SYNTAX = `icon-card "title" icon=${ICON_LIST} description="text"`;
const EXAMPLE = 'icon-card "Automated checks" icon=check description="Every change is verified."';

/** One 24×24 outline path per semantic icon, shared by browser and SVG renderers. */
export const ICON_CARD_PATHS = {
  check: 'M5 12l4 4L19 6',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 7v5l3 2',
  people: 'M8 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6M3 20c0-4 2-6 5-6s5 2 5 6M16 11a3 3 0 1 0 0-6M15 14c4 0 6 2 6 6',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10c-4-2-7-5-7-10V6z',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10M12 11v2',
  trend: 'M4 17l5-5 4 4 7-8M15 8h5v5',
} satisfies Record<IconCardIcon, string>;

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
