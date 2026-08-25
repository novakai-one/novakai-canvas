import { describe, expect, it } from 'vitest';
import { wireLabelSpread } from './wire-label-seed';

describe('wireLabelSpread', () => {
  it('is deterministic: the same wire id always lands the same spread', () => {
    expect(wireLabelSpread('wire-a')).toEqual(wireLabelSpread('wire-a'));
  });

  it('keeps the along-path offset inside the labelled slots', () => {
    for (const id of ['a', 'b', 'c', 'wire-1', 'wire-2', 'x9f']) {
      expect(Math.abs(wireLabelSpread(id).along)).toBeLessThanOrEqual(0.09);
      expect([1, -1]).toContain(wireLabelSpread(id).side);
    }
  });

  it('spreads distinct wires across slots and sides instead of stacking them', () => {
    const spreads = Array.from({ length: 20 }, (_, index) => wireLabelSpread(`wire-${index}`));
    expect(new Set(spreads.map((spread) => spread.along)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(spreads.map((spread) => spread.side)).size).toBe(2);
  });
});
