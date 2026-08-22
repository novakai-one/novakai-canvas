import { describe, expect, it } from 'vitest';
import { routeCollisions, routeWire, type Point } from '../../domain/diagram-geometry';
import { WIRE_SHAPES, asWireShape, wirePath } from './wire-shape';

/** A route that has to go around a box sitting between its two ends. */
const REQUEST = {
  source: { x: 0, y: 0 },
  sourceSide: 'right' as const,
  target: { x: 400, y: 0 },
  targetSide: 'left' as const,
  obstacles: [{ rect: { x: 150, y: -60, width: 120, height: 120 }, soft: false }],
};

function corners(path: string): number {
  return (path.match(/Q/g) ?? []).length;
}

describe('wire shapes', () => {
  it('draws every shape and preserves routed avoidance for the three routed presets', () => {
    const route = routeWire(REQUEST);
    expect(route.collisions).toBe(0);
    for (const shape of WIRE_SHAPES) {
      const drawn = wirePath(route.points, shape);
      expect(drawn.length, shape).toBeGreaterThan(0);
      if (shape !== 'straight') {
        expect(routeCollisions(route.points, REQUEST.obstacles).collisions, shape).toBe(0);
      }
    }
  });

  it('gives straight exactly one segment, end to end', () => {
    const points: Point[] = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 90 }, { x: 120, y: 90 }];
    expect(wirePath(points, 'straight')).toBe('M0,0L120,90');
  });

  it('rounds elbow and curved corners, and leaves stepped sharp', () => {
    const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(corners(wirePath(points, 'stepped'))).toBe(0);
    expect(corners(wirePath(points, 'elbow'))).toBe(1);
    expect(corners(wirePath(points, 'curved'))).toBe(1);
    // Curved rounds harder than elbow, which is the whole visible difference between them.
    expect(wirePath(points, 'curved')).not.toBe(wirePath(points, 'elbow'));
  });

  it('falls back to the elbow this app has always drawn for anything it cannot draw', () => {
    expect(asWireShape('curved')).toBe('curved');
    expect(asWireShape('spiral')).toBe('elbow');
    expect(asWireShape(undefined)).toBe('elbow');
  });
});
