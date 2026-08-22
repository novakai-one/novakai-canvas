/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TARGET_SIZES, targetScale } from './target-scale';

function canvasCss(): string {
  const text = [
    '../../styles/canvas-groups.css',
    '../../styles/canvas-wires.css',
  ].map((relativePath) => readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    'utf8',
  )).join('\n');
  if (text.length === 0) throw new Error('canvas.css read as empty');
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * The declaration block of one rule.
 *
 * Anchored to the start of a line so `.wire-label` cannot match the tail of
 * `.react-flow__edge.is-dimmed .wire-label`, which is a different rule about opacity.
 */
function rule(selector: string): string {
  const css = canvasCss();
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('target scale', () => {
  it('leaves medium at the base sizes and keeps the grab region far wider than the dot', () => {
    const medium = targetScale('medium');
    expect(medium).toMatchObject({ handle: 9, dot: 12, grab: 22, multiplier: 1 });
    expect(medium.grab / medium.dot).toBeGreaterThan(1.5);
  });

  it('scales every size together and never lands on a fractional pixel', () => {
    for (const size of TARGET_SIZES) {
      const scale = targetScale(size);
      for (const value of [scale.handle, scale.dot, scale.grab]) {
        expect(Number.isInteger(value), `${size}:${value}`).toBe(true);
      }
    }
    expect(targetScale('large').dot).toBeGreaterThan(targetScale('small').dot);
  });
});

/**
 * What is inside the zoom transform, and what is not.
 *
 * Measured in a real browser rather than assumed: wire ends, corridor handles and wire labels
 * are drawn inside React Flow's scaled viewport and shrink with it unless they divide by the
 * live zoom, while resize handles are drawn outside it and became three times too large when
 * they were given the same division. Both halves are pinned here because the difference is
 * invisible in the source.
 */
describe('canvas controls hold their size on screen', () => {
  it('divides every control drawn inside the viewport by the live zoom', () => {
    // Labels read the edge-label renderer's own copy of the zoom; the shapes read the surface's.
    for (const selector of ['.wire-endpoint', '.wire-segment-handle', '.wire-grab', '.wire-label']) {
      expect(rule(selector), selector).toMatch(/var\(--nvk-(label-)?zoom, 1\)/);
    }
  });

  it('leaves resize handles in plain screen pixels, because they sit outside the transform', () => {
    const handle = rule('.canvas-surface .react-flow__resize-control.handle');
    expect(handle).toContain('var(--target-sm)');
    expect(handle).not.toContain('--nvk-zoom');
  });

  it('keeps React Flow\'s own reconnect anchors out of the way of the grab region', () => {
    expect(rule('.canvas-surface .react-flow__edgeupdater')).toContain('pointer-events: none');
  });
});
