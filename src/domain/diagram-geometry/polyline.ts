import type { Point, Rect, RouteObstacle, RouteSide } from './contract.ts';

export function clamp(value: number, low: number, high: number): number {
  return low > high ? value : Math.min(Math.max(value, low), high);
}

export function advance(point: Point, side: RouteSide, distance: number): Point {
  if (side === 'top') return { x: point.x, y: point.y - distance };
  if (side === 'bottom') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

export function isVertical(side: RouteSide): boolean {
  return side === 'top' || side === 'bottom';
}

/** Drops repeated and collinear points so a route carries only real bends. */
export function simplify(points: Point[]): Point[] {
  const kept: Point[] = [];
  for (const point of points) {
    const last = kept.at(-1);
    if (last && last.x === point.x && last.y === point.y) continue;
    kept.push({ x: point.x, y: point.y });
  }
  const result: Point[] = [];
  for (let index = 0; index < kept.length; index += 1) {
    const previous = result.at(-1);
    const next = kept[index + 1];
    const collinear = previous && next
      && ((previous.x === kept[index].x && kept[index].x === next.x)
        || (previous.y === kept[index].y && kept[index].y === next.y));
    if (!collinear) result.push(kept[index]);
  }
  return result;
}

/** Manhattan length of an orthogonal polyline. */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.abs(points[index].x - points[index - 1].x)
      + Math.abs(points[index].y - points[index - 1].y);
  }
  return total;
}

/** Point and direction a fraction of the way along a polyline. */
export function pointAlong(points: Point[], t: number): Point & { angle: number } {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { ...points[0], angle: 0 };
  const target = clamp(t, 0, 1) * polylineLength(points);
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    if (length === 0) continue;
    if (travelled + length >= target) {
      const ratio = (target - travelled) / length;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
        angle: Math.atan2(to.y - from.y, to.x - from.x),
      };
    }
    travelled += length;
  }
  const last = points.at(-1) as Point;
  const previous = points.at(-2) as Point;
  return { ...last, angle: Math.atan2(last.y - previous.y, last.x - previous.x) };
}

/** Inverse of pointAlong: closest fraction to a loose point. */
export function nearestPositionAlong(points: Point[], target: Point): number {
  const total = polylineLength(points);
  if (total === 0) return 0;
  let travelled = 0;
  let best = { distance: Number.POSITIVE_INFINITY, position: 0 };
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const spanX = to.x - from.x;
    const spanY = to.y - from.y;
    const length = Math.abs(spanX) + Math.abs(spanY);
    if (length === 0) continue;
    const ratio = clamp(
      ((target.x - from.x) * spanX + (target.y - from.y) * spanY) / (spanX ** 2 + spanY ** 2),
      0,
      1,
    );
    const nearest = { x: from.x + spanX * ratio, y: from.y + spanY * ratio };
    const distance = (target.x - nearest.x) ** 2 + (target.y - nearest.y) ** 2;
    if (distance < best.distance) {
      best = { distance, position: (travelled + length * ratio) / total };
    }
    travelled += length;
  }
  return best.position;
}

/** SVG path for a polyline with bends rounded only as far as adjacent legs permit. */
export function routePath(points: Point[], radius = 6): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const inLength = Math.abs(corner.x - previous.x) + Math.abs(corner.y - previous.y);
    const outLength = Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y);
    const bend = Math.min(radius, inLength / 2, outLength / 2);
    if (bend <= 0) { path += `L${corner.x},${corner.y}`; continue; }
    const entry = {
      x: corner.x + Math.sign(previous.x - corner.x) * bend,
      y: corner.y + Math.sign(previous.y - corner.y) * bend,
    };
    const exit = {
      x: corner.x + Math.sign(next.x - corner.x) * bend,
      y: corner.y + Math.sign(next.y - corner.y) * bend,
    };
    path += `L${entry.x},${entry.y}Q${corner.x},${corner.y} ${exit.x},${exit.y}`;
  }
  const end = points.at(-1) as Point;
  return `${path}L${end.x},${end.y}`;
}

/** Whether one segment passes through a rectangle's interior; its border remains clear. */
export function segmentIntersectsRect(from: Point, to: Point, rect: Rect): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const overlaps = (lowA: number, highA: number, lowB: number, highB: number): boolean =>
    Math.min(highA, highB) - Math.max(lowA, lowB) > 0;
  if (from.y === to.y) {
    return from.y > top && from.y < bottom
      && overlaps(Math.min(from.x, to.x), Math.max(from.x, to.x), left, right);
  }
  if (from.x === to.x) {
    return from.x > left && from.x < right
      && overlaps(Math.min(from.y, to.y), Math.max(from.y, to.y), top, bottom);
  }
  return overlaps(Math.min(from.x, to.x), Math.max(from.x, to.x), left, right)
    && overlaps(Math.min(from.y, to.y), Math.max(from.y, to.y), top, bottom);
}

/** Counts route crossings, keeping hard node bodies separate from soft group frames. */
export function routeCollisions(
  points: Point[],
  obstacles: RouteObstacle[],
): { collisions: number; softCollisions: number } {
  let collisions = 0;
  let softCollisions = 0;
  for (const obstacle of obstacles) {
    const hit = points.some((point, index) => index > 0
      && segmentIntersectsRect(points[index - 1], point, obstacle.rect));
    if (!hit) continue;
    if (obstacle.soft) softCollisions += 1;
    else collisions += 1;
  }
  return { collisions, softCollisions };
}
