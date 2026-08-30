/**
 * The geometry of a node's border, one shape at a time.
 *
 * Coordinates are box-local: (0, 0) is the box's top-left corner, x grows right, y grows down.
 * Normalised coordinates measure a point from the box's centre in units of half the box's width
 * and half its height, so (1, 1) is the bottom-right corner whatever the box's size.
 *
 * Each shape is described exactly once, in `GEOMETRIES`: the unit circle, or a ring of corners.
 * Border paths, border points, widths and insets all derive from that one description, so the
 * drawn border and the measured border cannot drift apart.
 *
 * Every function here is total: no input throws, and no input returns a point outside the box.
 */

import type { ResolvedNodeShape } from '../../contract/schemas/node-appearance.ts';
import type { Position, Size } from '../../contract/types/spatial.ts';

/** One shape's border in normalised coordinates: the unit circle, or corners joined clockwise. */
type OutlineGeometry =
  | { readonly round: true }
  | { readonly round: false; readonly corners: readonly Position[] };

/** The single description of every shape. A new shape is one entry here plus one `NODE_SHAPES` member. */
const GEOMETRIES: Record<ResolvedNodeShape, OutlineGeometry> = {
  rect: {
    round: false,
    corners: [{ x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }],
  },
  ellipse: { round: true },
  diamond: {
    round: false,
    corners: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
  },
};

const FULL_TURN = Math.PI * 2;

/** Consecutive corner pairs, wrapping from the last corner back to the first. */
function edges(corners: readonly Position[]): ReadonlyArray<readonly [Position, Position]> {
  return corners.map((corner, index): readonly [Position, Position] =>
    [corner, corners[(index + 1) % corners.length]]);
}

/**
 * How far a normalised point sits from the centre, where the border is exactly 1: plain
 * distance for the circle, and for a polygon the fraction of the way from the centre to its
 * most-crossed edge line, by similar triangles.
 */
function measure(geometry: OutlineGeometry, nx: number, ny: number): number {
  if (geometry.round) return Math.hypot(nx, ny);
  let furthest = 0;
  for (const [a, b] of edges(geometry.corners)) {
    const alongX = b.x - a.x;
    const alongY = b.y - a.y;
    const toEdge = alongX * (ny - a.y) - alongY * (nx - a.x);
    const toCentre = alongX * (0 - a.y) - alongY * (0 - a.x);
    furthest = Math.max(furthest, 1 - toEdge / toCentre);
  }
  return furthest;
}

/** A normalised point placed in a box of the given size. */
function boxPoint(point: Position, size: Size): Position {
  return { x: (size.width / 2) * (1 + point.x), y: (size.height / 2) * (1 + point.y) };
}

/** The shape's border as one closed clockwise SVG path. */
export function outlinePath(shape: ResolvedNodeShape, size: Size): string {
  const geometry = GEOMETRIES[shape];
  if (geometry.round) {
    const rx = size.width / 2;
    const ry = size.height / 2;
    return `M ${rx} 0 A ${rx} ${ry} 0 1 1 ${rx} ${size.height} A ${rx} ${ry} 0 1 1 ${rx} 0 Z`;
  }
  const [first, ...rest] = geometry.corners.map((corner) => boxPoint(corner, size));
  return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')} Z`;
}

/**
 * The point on the border at `fraction` of one turn clockwise from top-centre. The turn is
 * measured in normalised coordinates, so a rectangle's corners always sit at .125, .375, .625
 * and .875 whatever its size. A fraction outside [0, 1) wraps. The direction's measure says
 * how far away the border is, so dividing by it lands the point exactly on the border.
 */
export function pointOnOutline(shape: ResolvedNodeShape, size: Size, fraction: number): Position {
  const angle = (fraction - Math.floor(fraction)) * FULL_TURN;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const reach = 1 / measure(GEOMETRIES[shape], dx, dy);
  return boxPoint({ x: reach * dx, y: reach * dy }, size);
}

/**
 * The border point in the direction of a box-local point from the centre. A point already on
 * the border comes back unchanged. The centre itself names no direction, so it maps to the
 * top-centre border point, keeping the promise that every input lands on the border.
 */
export function outlinePointToward(
  shape: ResolvedNodeShape,
  size: Size,
  point: Position,
): Position {
  const nx = size.width === 0 ? 0 : (2 * point.x) / size.width - 1;
  const ny = size.height === 0 ? 0 : (2 * point.y) / size.height - 1;
  const distance = measure(GEOMETRIES[shape], nx, ny);
  if (distance === 0) return boxPoint({ x: 0, y: -1 }, size);
  return boxPoint({ x: nx / distance, y: ny / distance }, size);
}

/**
 * Where a horizontal line at box-local `y` leaves the border on the right, exactly. A `y` above
 * or below the box returns the box's vertical centre line, the one x every shape still owns.
 */
export function outlineXAtY(shape: ResolvedNodeShape, size: Size, y: number): number {
  const halfHeight = size.height / 2;
  const ny = halfHeight === 0 ? 0 : (y - halfHeight) / halfHeight;
  return (size.width / 2) * (1 + rightmostInside(GEOMETRIES[shape], ny));
}

/** The widest normalised half-width still inside the border at normalised height `ny`. */
function rightmostInside(geometry: OutlineGeometry, ny: number): number {
  if (geometry.round) return Math.sqrt(Math.max(0, 1 - ny * ny));
  let widest = 0;
  for (const [a, b] of edges(geometry.corners)) {
    if (ny < Math.min(a.y, b.y) || ny > Math.max(a.y, b.y)) continue;
    widest = a.y === b.y
      ? Math.max(widest, a.x, b.x)
      : Math.max(widest, a.x + ((b.x - a.x) * (ny - a.y)) / (b.y - a.y));
  }
  return widest;
}

/**
 * The largest centred box of content that fits inside the border, as one fraction of the
 * shape's half-width and half-height: 1 for a rectangle, 1/√2 for an ellipse, ½ for a diamond.
 */
export function contentInset(shape: ResolvedNodeShape): number {
  return 1 / measure(GEOMETRIES[shape], 1, 1);
}

/** The largest centred box of content that fits inside the border, in box-local coordinates. */
export function inscribedContentBox(
  shape: ResolvedNodeShape,
  size: Size,
): { x: number; y: number; width: number; height: number } {
  const fraction = contentInset(shape);
  return {
    x: (size.width * (1 - fraction)) / 2,
    y: (size.height * (1 - fraction)) / 2,
    width: size.width * fraction,
    height: size.height * fraction,
  };
}
