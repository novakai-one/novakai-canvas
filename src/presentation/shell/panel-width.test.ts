import { describe, expect, it } from 'vitest';
import {
  RAIL_BOUNDS, STUDIO_BOUNDS, clampPanelWidth, widthFromDrag,
} from './panel-width';

describe('clampPanelWidth', () => {
  it('keeps a legal width untouched', () => {
    expect(clampPanelWidth(300, RAIL_BOUNDS, 264)).toBe(300);
  });

  it('parks an over-wide width at the maximum instead of letting a panel eat the canvas', () => {
    expect(clampPanelWidth(9000, RAIL_BOUNDS, 264)).toBe(RAIL_BOUNDS.max);
  });

  it('parks an under-wide width at the minimum instead of collapsing by accident', () => {
    expect(clampPanelWidth(10, STUDIO_BOUNDS, 340)).toBe(STUDIO_BOUNDS.min);
  });

  it('falls back when preferences carry no width — an older file must still open', () => {
    expect(clampPanelWidth(undefined, STUDIO_BOUNDS, 340)).toBe(340);
    expect(clampPanelWidth(Number.NaN, STUDIO_BOUNDS, 340)).toBe(340);
  });

  it('rounds to whole pixels so a stored width never carries drag noise', () => {
    expect(clampPanelWidth(301.6, RAIL_BOUNDS, 264)).toBe(302);
  });
});

describe('widthFromDrag', () => {
  it('grows a left panel as the pointer moves right', () => {
    expect(widthFromDrag('left', 264, 40, RAIL_BOUNDS)).toBe(304);
  });

  it('grows a right panel as the pointer moves left', () => {
    expect(widthFromDrag('right', 340, -40, STUDIO_BOUNDS)).toBe(380);
  });

  it('clamps a drag that overshoots the edge', () => {
    expect(widthFromDrag('left', 264, 900, RAIL_BOUNDS)).toBe(RAIL_BOUNDS.max);
    expect(widthFromDrag('right', 340, 900, STUDIO_BOUNDS)).toBe(STUDIO_BOUNDS.min);
  });
});
