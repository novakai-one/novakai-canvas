/**
 * Orthogonal wire geometry — the one router every wire renderer uses.
 *
 * Pure and framework-free on purpose: the browser edge component, a future SVG snapshot, and the
 * routing gate that checks Chris's real diagrams all ask the same function for the same answer,
 * so a wire cannot look one way on screen and another way in a check.
 *
 * Deterministic by contract: the same request always yields the same polyline. Nothing here
 * reads a clock, a random source, or the DOM.
 */

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

/** Which edge of a node an endpoint leaves from or arrives at. */
export type RouteSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * Something a wire should not cross.
 *
 * `soft` marks a group frame. A wire between two nodes in different groups has to cross a frame
 * to exist at all, so frames are avoided when a clear route exists and tolerated when none does;
 * a `soft: false` node body is never acceptable.
 */
export interface RouteObstacle { rect: Rect; soft: boolean }

export interface WireRouteRequest {
  source: Point;
  sourceSide: RouteSide;
  target: Point;
  targetSide: RouteSide;
  /** Rectangles this wire has no relationship with. Empty means "route straight". */
  obstacles?: RouteObstacle[];
  /** Human-placed corridor points. When present they are obeyed, not optimised away. */
  waypoints?: Point[];
  /** Signed perpendicular offset that spreads wires sharing a node pair. */
  lane?: number;
  /** Distance travelled straight out of a node before the first turn. */
  stub?: number;
}

export interface WireRoute {
  points: Point[];
  /** Unrelated node bodies this route crosses. Zero is the standard the gate enforces. */
  collisions: number;
  /** Group frames this route crosses — tolerated, counted, never ignored. */
  softCollisions: number;
}

const DEFAULT_STUB = 22;
/** Clearance kept around an obstacle when detouring, so a wire never grazes a node. */
const CLEARANCE = 14;

function clamp(value: number, low: number, high: number): number {
  return low > high ? value : Math.min(Math.max(value, low), high);
}

function advance(point: Point, side: RouteSide, distance: number): Point {
  if (side === 'top') return { x: point.x, y: point.y - distance };
  if (side === 'bottom') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function isVertical(side: RouteSide): boolean {
  return side === 'top' || side === 'bottom';
}

/** Drops repeated and collinear points so a route carries only the bends it really has. */
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
    if (collinear) continue;
    result.push(kept[index]);
  }
  return result;
}

/** Total length of a polyline, used for label placement and for scoring candidate routes. */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.abs(points[index].x - points[index - 1].x)
      + Math.abs(points[index].y - points[index - 1].y);
  }
  return total;
}

/** The point a fraction `t` of the way along a polyline, with the direction it travels there. */
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

/**
 * The fraction of the way along a polyline that sits closest to a loose point.
 *
 * The inverse of `pointAlong`: it turns "the human dropped the label here" into the durable
 * 0..1 the record stores, so the label keeps its place when the wire is rerouted.
 */
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

/** SVG path for a polyline with rounded bends; the radius shrinks to fit short segments. */
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

/**
 * Whether a straight segment passes through a rectangle's interior.
 *
 * A segment running exactly along a border is clear: wires that hug a node's edge read as
 * following it, not as cutting through it.
 */
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
  // Diagonals never occur in an orthogonal route; the bounding box is a safe conservative answer.
  return overlaps(Math.min(from.x, to.x), Math.max(from.x, to.x), left, right)
    && overlaps(Math.min(from.y, to.y), Math.max(from.y, to.y), top, bottom);
}

/** How many obstacles a whole route crosses, split by whether crossing is ever acceptable. */
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

/** The plain elbow: out of the source, across a corridor, into the target. */
function elbowCandidate(request: WireRouteRequest, corridor: number): Point[] {
  const { source, sourceSide, target, targetSide } = request;
  const stub = request.stub ?? DEFAULT_STUB;
  const sourceOut = advance(source, sourceSide, stub);
  const targetOut = advance(target, targetSide, stub);
  if (isVertical(sourceSide) && isVertical(targetSide)) {
    const low = Math.min(sourceOut.y, targetOut.y);
    const high = Math.max(sourceOut.y, targetOut.y);
    const y = clamp(corridor, low, high);
    return simplify([source, { x: source.x, y }, { x: target.x, y }, target]);
  }
  if (!isVertical(sourceSide) && !isVertical(targetSide)) {
    const low = Math.min(sourceOut.x, targetOut.x);
    const high = Math.max(sourceOut.x, targetOut.x);
    const x = clamp(corridor, low, high);
    return simplify([source, { x, y: source.y }, { x, y: target.y }, target]);
  }
  const bend = isVertical(sourceSide)
    ? { x: source.x, y: target.y }
    : { x: target.x, y: source.y };
  return simplify([source, bend, target]);
}

/** The detour: out of both ends, then around through a side corridor. */
function detourCandidate(request: WireRouteRequest, corridor: number): Point[] {
  const { source, sourceSide, target, targetSide } = request;
  const stub = request.stub ?? DEFAULT_STUB;
  const sourceOut = advance(source, sourceSide, stub);
  const targetOut = advance(target, targetSide, stub);
  if (isVertical(sourceSide) && isVertical(targetSide)) {
    return simplify([
      source, sourceOut,
      { x: corridor, y: sourceOut.y }, { x: corridor, y: targetOut.y },
      targetOut, target,
    ]);
  }
  return simplify([
    source, sourceOut,
    { x: sourceOut.x, y: corridor }, { x: targetOut.x, y: corridor },
    targetOut, target,
  ]);
}

/** True when a plain elbow can reach the target without doubling back through either node. */
function elbowIsForward(request: WireRouteRequest): boolean {
  const stub = request.stub ?? DEFAULT_STUB;
  const sourceOut = advance(request.source, request.sourceSide, stub);
  const targetOut = advance(request.target, request.targetSide, stub);
  if (isVertical(request.sourceSide) && isVertical(request.targetSide)) {
    return request.sourceSide === 'bottom'
      ? targetOut.y >= sourceOut.y : targetOut.y <= sourceOut.y;
  }
  if (!isVertical(request.sourceSide) && !isVertical(request.targetSide)) {
    return request.sourceSide === 'right'
      ? targetOut.x >= sourceOut.x : targetOut.x <= sourceOut.x;
  }
  return true;
}

/** Corridor positions worth trying: the midpoint first, then the clear side of each obstacle. */
function corridorCandidates(request: WireRouteRequest, axis: 'x' | 'y'): number[] {
  const stub = request.stub ?? DEFAULT_STUB;
  const lane = request.lane ?? 0;
  const sourceOut = advance(request.source, request.sourceSide, stub);
  const targetOut = advance(request.target, request.targetSide, stub);
  const middle = (sourceOut[axis] + targetOut[axis]) / 2 + lane;
  const values = [middle];
  for (const obstacle of request.obstacles ?? []) {
    const { rect } = obstacle;
    const low = axis === 'x' ? rect.x : rect.y;
    const high = axis === 'x' ? rect.x + rect.width : rect.y + rect.height;
    values.push(low - CLEARANCE + lane, high + CLEARANCE + lane);
  }
  // Nearest-to-the-middle first: a detour that has to happen should still be the smallest one.
  return [...new Set(values)].sort((left, right) =>
    Math.abs(left - middle) - Math.abs(right - middle) || left - right);
}

/** The side corridor used when the wire has to go around: outside every rect it must clear. */
function detourCandidates(request: WireRouteRequest, axis: 'x' | 'y'): number[] {
  const lane = request.lane ?? 0;
  const from = request.source[axis];
  const to = request.target[axis];
  const spans = (request.obstacles ?? []).map((obstacle) => obstacle.rect);
  const lows = [Math.min(from, to), ...spans.map((rect) => (axis === 'x' ? rect.x : rect.y))];
  const highs = [Math.max(from, to), ...spans.map((rect) =>
    (axis === 'x' ? rect.x + rect.width : rect.y + rect.height))];
  const outside = [
    Math.min(...lows) - CLEARANCE * 2 + lane,
    Math.max(...highs) + CLEARANCE * 2 + lane,
  ];
  const near = [
    Math.min(from, to) - CLEARANCE * 2 + lane,
    Math.max(from, to) + CLEARANCE * 2 + lane,
  ];
  const preferred = from <= to ? [near[0], near[1]] : [near[1], near[0]];
  return [...new Set([...preferred, ...outside])];
}

/**
 * Routes one wire.
 *
 * Human waypoints win outright. Otherwise a small, fixed set of candidates is scored — bodies
 * crossed first, then frames, then length, then bends — and the best one is returned. The
 * candidate set is bounded, so routing stays fast on a diagram with a hundred wires.
 */
export function routeWire(request: WireRouteRequest): WireRoute {
  const obstacles = request.obstacles ?? [];
  if (request.waypoints && request.waypoints.length > 0) {
    const points = simplify(waypointRoute(request));
    return { points, ...routeCollisions(points, obstacles) };
  }

  const axis = isVertical(request.sourceSide) ? 'y' : 'x';
  const detourAxis = axis === 'y' ? 'x' : 'y';
  const candidates: Point[][] = [];
  if (elbowIsForward(request)) {
    for (const corridor of corridorCandidates(request, axis).slice(0, 24)) {
      candidates.push(elbowCandidate(request, corridor));
    }
  }
  for (const corridor of detourCandidates(request, detourAxis).slice(0, 12)) {
    candidates.push(detourCandidate(request, corridor));
  }

  let best: WireRoute | null = null;
  for (const points of candidates) {
    const counts = routeCollisions(points, obstacles);
    const candidate = { points, ...counts };
    if (!best || score(candidate) < score(best)) best = candidate;
    if (best.collisions === 0 && best.softCollisions === 0) break;
  }
  return best ?? { points: [request.source, request.target], collisions: 0, softCollisions: 0 };
}

/** Bodies crossed dominate; then frames; then a shorter, simpler path. */
function score(route: WireRoute): number {
  return route.collisions * 1e9 + route.softCollisions * 1e6
    + polylineLength(route.points) + route.points.length * 40;
}

/** An orthogonal chain through every human-placed waypoint, in order. */
function waypointRoute(request: WireRouteRequest): Point[] {
  const stub = request.stub ?? DEFAULT_STUB;
  const points: Point[] = [request.source, advance(request.source, request.sourceSide, stub)];
  let cursor = points[1];
  let vertical = isVertical(request.sourceSide);
  for (const waypoint of request.waypoints ?? []) {
    const bend = vertical ? { x: cursor.x, y: waypoint.y } : { x: waypoint.x, y: cursor.y };
    points.push(bend, waypoint);
    cursor = waypoint;
    vertical = !vertical;
  }
  const targetOut = advance(request.target, request.targetSide, stub);
  const closing = isVertical(request.targetSide)
    ? { x: cursor.x, y: targetOut.y } : { x: targetOut.x, y: cursor.y };
  points.push(closing, targetOut, request.target);
  return points;
}
