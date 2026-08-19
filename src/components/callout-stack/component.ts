/**
 * A callout stack owns ordered, explicitly identified highlights. This pure component owns the
 * item schema, child DSL and duplicate rule, generic inspector descriptions, size, and snapshot.
 */

import { z } from 'zod';
import type { CalloutItem, CalloutKind } from '../../domain/model.ts';
import { namedNodeDeclaration, type ComponentItem, type DiagramComponent } from '../component.ts';

const KINDS = ['info', 'warning', 'decision', 'success'] as const;
const KIND_LIST = KINDS.join('|');
const SYNTAX = `callout "text" id=<stable-id> kind=${KIND_LIST}`;
const EXAMPLE = 'callout "Evidence is complete" id=evidence kind=info';
const COLORS = {
  card: '#252529', ink: '#ececee', border: '#2f2f34', muted: '#9a9aa2',
  info: '#9a9aa2', warning: '#d0a14b', decision: '#e2ba6e', success: '#78a886',
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
  if (inline) return { key, value: inline, next: index + 1 };
  const value = tokens[index + 1];
  return { key, value: value ?? '', next: value === undefined ? index + 1 : index + 2 };
}

function calloutItems(callouts: CalloutItem[]): ComponentItem[] {
  return callouts.map((callout) => ({
    collection: 'callouts',
    id: callout.id,
    kind: callout.kind,
    label: callout.text,
    fields: [
      { label: 'ID', value: callout.id },
      { label: 'Kind', value: callout.kind },
      { label: 'Text', value: callout.text },
    ],
  }));
}

const calloutSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(KINDS),
  text: z.string().min(1),
});

const calloutsSchema = z.array(calloutSchema).superRefine((callouts, context) => {
  const seen = new Set<string>();
  callouts.forEach((callout, index) => {
    if (seen.has(callout.id)) {
      context.addIssue({ code: 'custom', message: `duplicate callout id "${callout.id}"`, path: [index, 'id'] });
    }
    seen.add(callout.id);
  });
});

export const calloutStackComponent: DiagramComponent<'callout-stack'> = {
  kind: 'callout-stack',
  dslKeyword: 'callout-stack',
  declaration: namedNodeDeclaration('callout-stack', 'Release decision'),
  layoutRole: 'leaf',
  contentFields: { callouts: calloutsSchema.optional() },
  items(node) {
    return calloutItems(node.callouts ?? []);
  },
  dslChildren: [{
    keyword: 'callout',
    syntax: SYNTAX,
    example: EXAMPLE,
    contentKey: 'callouts',
    parse(tokens) {
      const text = tokens[1];
      if (!text || text.includes('=')) return { error: 'callout needs text', hint: SYNTAX };

      const fields: Record<string, string> = {};
      for (let index = 2; index < tokens.length;) {
        const field = assignment(tokens, index);
        if (!field || !['id', 'kind'].includes(field.key)) {
          return { error: `unexpected "${tokens[index]}" in callout`, hint: SYNTAX };
        }
        if (field.key in fields) return { error: `callout repeats ${field.key}`, hint: SYNTAX };
        if (!field.value) return { error: `callout ${field.key} cannot be empty`, hint: SYNTAX };
        fields[field.key] = field.value;
        index = field.next;
      }
      if (!fields.id) return { error: 'callout needs id=<stable-id>', hint: SYNTAX };
      if (!fields.kind) return { error: `callout needs kind=${KIND_LIST}`, hint: SYNTAX };
      if (!KINDS.includes(fields.kind as CalloutKind)) {
        return { error: `unknown callout kind "${fields.kind}"; use one of: ${KIND_LIST}`, hint: SYNTAX };
      }
      return { content: { id: fields.id, kind: fields.kind as CalloutKind, text } satisfies CalloutItem };
    },
    validate(content, existingSiblings) {
      const callout = content as CalloutItem;
      if (existingSiblings.some((sibling) => (sibling as CalloutItem).id === callout.id)) {
        return { error: `duplicate callout id "${callout.id}"`, hint: SYNTAX };
      }
      return undefined;
    },
    print(node) {
      return (node.callouts ?? []).map(
        (callout) => `  callout "${callout.text}" id=${callout.id} kind=${callout.kind}`,
      );
    },
  }],
  measure(node) {
    const callouts = node.callouts ?? [];
    const longest = Math.max(node.label.length, ...callouts.map((callout) => callout.text.length));
    return {
      width: Math.min(440, Math.max(260, 96 + Math.round(6.2 * longest))),
      height: 58 + callouts.length * 42 + 14,
    };
  },
  renderSvg(node, box) {
    const { x, y, width, height } = box;
    const callouts = node.callouts ?? [];
    const parts = [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.card}" stroke="${COLORS.border}" rx="6"/>`,
      `<text x="${x + 14}" y="${y + 25}" fill="${COLORS.ink}" font-family="${FONT}" font-size="13" font-weight="600">${esc(node.label)}</text>`,
    ];
    callouts.forEach((callout, index) => {
      const rowY = y + 43 + index * 42;
      parts.push(`<rect x="${x + 12}" y="${rowY}" width="${width - 24}" height="34" fill="none" stroke="${COLORS.border}" rx="4"/>`);
      parts.push(`<rect x="${x + 12}" y="${rowY}" width="3" height="34" fill="${COLORS[callout.kind]}" rx="1.5"/>`);
      parts.push(`<text x="${x + 24}" y="${rowY + 14}" fill="${COLORS[callout.kind]}" font-family="${FONT}" font-size="8">${esc(callout.kind.toUpperCase())}</text>`);
      parts.push(`<text x="${x + 24}" y="${rowY + 27}" fill="${COLORS.ink}" font-family="${FONT}" font-size="10">${esc(callout.text)}</text>`);
    });
    return parts.join('\n');
  },
};
