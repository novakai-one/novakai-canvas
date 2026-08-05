import { describe, expect, it } from 'vitest';
import {
  pointAlong, polylineLength, routePath, routeWire, segmentIntersectsRect,
} from './wire-routing';

/** Every routed wire must be orthogonal: each segment moves in exactly one axis. */
function isOrthogonal(points: { x: number; y: number }[]): boolean {
  return points.every((point, index) => index === 0
    || point.x === points[index - 1].x || point.y === points[index - 1].y);
}

describe('routeWire', () => {
  it('leaves the source side and enters the target side', () => {
    const route = routeWire({
      source: { x: 100, y: 100 }, sourceSide: 'bottom',
      target: { x: 400, y: 400 }, targetSide: 'top',
    });
    expect(route.points[0]).toEqual({ x: 100, y: 100 });
    expect(route.points.at(-1)).toEqual({ x: 400, y: 400 });
    // First move is downward out of the source, last move is downward into the target.
    expect(route.points[1].y).toBeGreaterThan(100);
    expect(route.points.at(-2)!.y).toBeLessThan(400);
  });

  it('routes with axis-aligned segments only', () => {
    const forward = routeWire({
      source: { x: 100, y: 100 }, sourceSide: 'bottom',
      target: { x: 400, y: 400 }, targetSide: 'top',
    });
    const backward = routeWire({
      source: { x: 100, y: 400 }, sourceSide: 'bottom',
      target: { x: 400, y: 100 }, targetSide: 'top',
    });
    expect(isOrthogonal(forward.points)).toBe(true);
    expect(isOrthogonal(backward.points)).toBe(true);
  });

  it('detours around when the target sits above the source', () => {
    const route = routeWire({
      source: { x: 100, y: 400 }, sourceSide: 'bottom',
      target: { x: 400, y: 100 }, targetSide: 'top',
    });
    // The wire must leave downward and arrive downward, so it needs a side corridor.
    expect(route.points.length).toBeGreaterThanOrEqual(6);
    const corridor = route.points.map((point) => point.x);
    expect(Math.min(...corridor)).toBeLessThan(100);
  });

  it('separates parallel wires by their lane offset', () => {
    const request = {
      source: { x: 100, y: 100 }, sourceSide: 'bottom' as const,
      target: { x: 400, y: 400 }, targetSide: 'top' as const,
    };
    const first = routeWire({ ...request, lane: -18 });
    const second = routeWire({ ...request, lane: 18 });
    expect(first.points[1].y).not.toEqual(second.points[1].y);
    expect(second.points[1].y - first.points[1].y).toBe(36);
  });

  it('is deterministic: the same request always produces the same route', () => {
    const request = {
      source: { x: 12, y: 34 }, sourceSide: 'bottom' as const,
      target: { x: 560, y: 21 }, targetSide: 'top' as const,
      obstacles: [{ rect: { x: 100, y: 0, width: 200, height: 200 }, soft: false }],
    };
    expect(routeWire(request)).toEqual(routeWire(request));
  });
});

describe('pointAlong', () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

  it('returns the ends at t=0 and t=1', () => {
    expect(pointAlong(square, 0)).toMatchObject({ x: 0, y: 0 });
    expect(pointAlong(square, 1)).toMatchObject({ x: 100, y: 100 });
  });

  it('measures the halfway point by length, not by vertex count', () => {
    expect(pointAlong(square, 0.5)).toMatchObject({ x: 100, y: 0 });
  });

  it('clamps a t outside 0..1', () => {
    expect(pointAlong(square, -3)).toMatchObject({ x: 0, y: 0 });
    expect(pointAlong(square, 9)).toMatchObject({ x: 100, y: 100 });
  });

  it('measures total length along every segment', () => {
    expect(polylineLength(square)).toBe(200);
  });
});

describe('routePath', () => {
  it('draws a rounded elbow through every point', () => {
    const path = routePath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 6);
    expect(path.startsWith('M0,0')).toBe(true);
    expect(path).toContain('Q');
    expect(path.endsWith('100,100')).toBe(true);
  });
});

describe('segmentIntersectsRect', () => {
  const rect = { x: 100, y: 100, width: 100, height: 100 };

  it('detects a segment crossing the rectangle', () => {
    expect(segmentIntersectsRect({ x: 0, y: 150 }, { x: 300, y: 150 }, rect)).toBe(true);
  });

  it('detects a segment starting inside the rectangle', () => {
    expect(segmentIntersectsRect({ x: 150, y: 150 }, { x: 300, y: 150 }, rect)).toBe(true);
  });

  it('ignores a segment that misses the rectangle', () => {
    expect(segmentIntersectsRect({ x: 0, y: 50 }, { x: 300, y: 50 }, rect)).toBe(false);
    expect(segmentIntersectsRect({ x: 0, y: 0 }, { x: 0, y: 300 }, rect)).toBe(false);
  });

  it('treats a wire grazing the border as clear', () => {
    expect(segmentIntersectsRect({ x: 0, y: 100 }, { x: 300, y: 100 }, rect)).toBe(false);
  });
});
