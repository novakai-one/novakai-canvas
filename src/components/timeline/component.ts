/**
 * `timeline` nodes hold ordered steps (`node.steps`, present only on this kind). One step is one
 * turn on a line: a label, and optionally the session a fork of that turn produced.
 *
 * This component owns its content shape, its `step` DSL child line, its content-driven size, and
 * its `./canvas snapshot` SVG body.
 */

import { z } from 'zod';
import type { DiagramComponent } from '../component.ts';

export interface TimelineStep { id: string; label: string; fork?: string }

const STEP_SHAPE = 'step "turn 1" [fork="session-id"]';
const DOT = '#0F6E56';
const COLORS = { card: '#252529', ink: '#ececee', border: '#2f2f34', muted: '#9a9aa2' };
const FONT = 'Inter, sans-serif';

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Stable-enough id for a step: the label slug, which is what the DSL round-trips. */
function stepId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step';
}

export const timelineComponent: DiagramComponent<'timeline'> = {
  kind: 'timeline',
  dslKeyword: 'timeline',
  layoutRole: 'leaf',
  contentFields: {
    steps: z.array(z.object({
      id: z.string(), label: z.string(), fork: z.string().optional(),
    })).optional(),
  },
  dslChildren: [{
    keyword: 'step',
    contentKey: 'steps',
    parse(tokens) {
      const label = tokens[1];
      if (label === undefined || label.length === 0 || label.includes('=')) {
        return { error: 'step needs a label', hint: STEP_SHAPE };
      }
      let fork: string | undefined;
      for (let index = 2; index < tokens.length; index += 1) {
        const token = tokens[index];
        // `fork="x"` tokenizes as `fork=` plus the quoted value; `fork=x` arrives whole.
        if (token === 'fork=' && tokens[index + 1] !== undefined) fork = tokens[(index += 1)];
        else if (token.startsWith('fork=') && token.length > 'fork='.length) fork = token.slice('fork='.length);
        else return { error: `unexpected "${token}" in step`, hint: STEP_SHAPE };
      }
      const step: TimelineStep = { id: stepId(label), label, ...(fork ? { fork } : {}) };
      return { content: step };
    },
    print(node) {
      return (node.steps ?? []).map(
        (step) => `  step "${step.label}"${step.fork ? ` fork="${step.fork}"` : ''}`,
      );
    },
  }],
  measure(node) {
    const steps = node.steps ?? [];
    const longest = Math.max(0, ...steps.map(
      (step) => step.label.length + (step.fork ? step.fork.length + 10 : 0),
    ));
    return {
      width: Math.min(420, Math.max(220, 72 + Math.round(7.2 * longest))),
      height: 56 + steps.length * 28 + 16,
    };
  },
  renderSvg(node, box) {
    const { x, y, width, height } = box;
    const steps = node.steps ?? [];
    const parts: string[] = [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.card}" stroke="${COLORS.border}" rx="6"/>`,
      `<text x="${x + 14}" y="${y + 24}" fill="${COLORS.ink}" font-family="${FONT}" font-size="13" font-weight="600">${esc(node.label)}</text>`,
    ];
    steps.forEach((step, index) => {
      const dotY = y + 48 + index * 28 - 4;
      if (index < steps.length - 1) {
        parts.push(`<line x1="${x + 24}" y1="${dotY + 5}" x2="${x + 24}" y2="${dotY + 28 - 5}" stroke="${DOT}" stroke-width="1.4"/>`);
      }
      parts.push(`<circle cx="${x + 24}" cy="${dotY}" r="5" fill="${DOT}"/>`);
      const fork = step.fork ? ` → fork: ${step.fork}` : '';
      parts.push(`<text x="${x + 40}" y="${y + 48 + index * 28}" fill="${step.fork ? COLORS.muted : COLORS.ink}" font-family="${FONT}" font-size="11">${esc(`${step.label}${fork}`)}</text>`);
    });
    return parts.join('\n');
  },
};
