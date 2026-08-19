/**
 * A metric is one semantic value with optional context and status. This pure component owns its
 * stored fields, parent DSL declaration, content-driven size, and snapshot rendering.
 */

import { z } from 'zod';
import type { CanvasNode } from '../../domain/records.ts';
import type { DslNodeDeclaration, DiagramComponent } from '../component.ts';

const STATUSES = ['neutral', 'success', 'warning', 'critical'] as const;
const SYNTAX = 'metric "label" value="text" [detail="text"] [status=neutral|success|warning|critical]';
const EXAMPLE = 'metric "Success rate" value="92%" detail="12 of 13 runs" status=success';
const COLORS = {
  card: '#252529', ink: '#ececee', border: '#2f2f34', muted: '#9a9aa2',
  neutral: '#9a9aa2', success: '#78a886', warning: '#d0a14b', critical: '#c8a798',
};
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
  if (inline.length > 0) return { key, value: inline, next: index + 1 };
  const value = tokens[index + 1];
  if (value === undefined) return { key, value: '', next: index + 1 };
  return { key, value, next: index + 2 };
}

const declaration: DslNodeDeclaration = {
  syntax: SYNTAX,
  example: EXAMPLE,
  allowsBody: false,
  parse(tokens) {
    const label = tokens[1];
    if (!label || label.includes('=')) return { error: 'metric needs a label', hint: EXAMPLE };

    const content: Record<string, string> = {};
    for (let index = 2; index < tokens.length;) {
      const field = assignment(tokens, index);
      if (!field || !['value', 'detail', 'status'].includes(field.key)) {
        return { error: `unexpected "${tokens[index]}" in metric`, hint: SYNTAX };
      }
      if (field.key in content) return { error: `metric repeats ${field.key}`, hint: SYNTAX };
      if (field.value.length === 0) return { error: `metric ${field.key} cannot be empty`, hint: SYNTAX };
      content[field.key] = field.value;
      index = field.next;
    }
    if (!content.value) return { error: 'metric needs value="text"', hint: EXAMPLE };
    if (content.status && !STATUSES.includes(content.status as (typeof STATUSES)[number])) {
      return { error: `unknown metric status "${content.status}"`, hint: SYNTAX };
    }
    return { label, content };
  },
  print(node) {
    return `metric "${node.label}" value="${node.value}"`
      + `${node.detail ? ` detail="${node.detail}"` : ''}`
      + `${node.status ? ` status=${node.status}` : ''}`;
  },
};

export const metricComponent: DiagramComponent<'metric'> = {
  kind: 'metric',
  dslKeyword: 'metric',
  declaration,
  layoutRole: 'leaf',
  contentFields: {
    value: z.string().min(1),
    detail: z.string().min(1).optional(),
    status: z.enum(STATUSES).optional(),
  },
  measure(node) {
    const longest = Math.max(node.label.length, node.value?.length ?? 0, node.detail?.length ?? 0);
    return {
      width: Math.min(360, Math.max(200, 96 + Math.round(6.8 * longest))),
      height: node.detail ? 148 : 126,
    };
  },
  renderSvg(node: CanvasNode, box) {
    const { x, y, width, height } = box;
    const status = node.status ?? 'neutral';
    const statusColor = COLORS[status];
    const parts = [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.card}" stroke="${COLORS.border}" rx="6"/>`,
      `<text x="${x + 16}" y="${y + 25}" fill="${COLORS.ink}" font-family="${FONT}" font-size="13" font-weight="600">${esc(node.label)}</text>`,
      `<text x="${x + 16}" y="${y + 72}" fill="${statusColor}" font-family="${FONT}" font-size="30" font-weight="700">${esc(node.value ?? '')}</text>`,
      `<text x="${x + width - 16}" y="${y + 24}" fill="${statusColor}" font-family="${FONT}" font-size="9" text-anchor="end">${esc(status.toUpperCase())}</text>`,
    ];
    if (node.detail) {
      parts.push(`<text x="${x + 16}" y="${y + 101}" fill="${COLORS.muted}" font-family="${FONT}" font-size="11">${esc(node.detail)}</text>`);
    }
    return parts.join('\n');
  },
};
