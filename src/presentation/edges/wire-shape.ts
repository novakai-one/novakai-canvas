import { routePath, type Point } from '../../domain/diagram-geometry.ts';
import { WIRE_SHAPES, type WireShape } from '../../domain/wire-appearance.ts';

export { WIRE_SHAPES } from '../../domain/wire-appearance.ts';

/**
 * How a wire is drawn along the route it was given.
 *
 * Elbow, curved and stepped paint the router's obstacle-aware points. Straight is the deliberate
 * direct-line preset and joins the endpoints without those intermediate turns.
 */
/** One line per shape, for the control that offers them. */
export const WIRE_SHAPE_HINTS: Record<WireShape, string> = {
  elbow: 'Right angles with rounded corners',
  straight: 'One direct line, end to end',
  curved: 'Right angles, smoothed through',
  stepped: 'Right angles, sharp corners',
};

/** How far a curved shape rounds its corners, relative to the shortest leg of the bend. */
const CURVE_RADIUS = 28;

/** Rounded elbows, at the radius the app has always drawn. */
const ELBOW_RADIUS = 6;

/**
 * The SVG path for one route under one shape.
 *
 * Deterministic and DOM-free: the same points and shape always produce the same string, so a
 * snapshot, a test and the screen cannot disagree about what a wire looks like.
 */
export function wirePath(points: Point[], shape: WireShape): string {
  if (points.length === 0) return '';
  if (shape === 'straight') {
    const from = points[0];
    const to = points.at(-1) as Point;
    return `M${from.x},${from.y}L${to.x},${to.y}`;
  }
  if (shape === 'stepped') return routePath(points, 0);
  if (shape === 'curved') return routePath(points, CURVE_RADIUS);
  return routePath(points, ELBOW_RADIUS);
}

/** Whether a stored value is a shape this app can draw; anything else falls back to elbow. */
export function asWireShape(value: unknown): WireShape {
  return WIRE_SHAPES.includes(value as WireShape) ? (value as WireShape) : 'elbow';
}
