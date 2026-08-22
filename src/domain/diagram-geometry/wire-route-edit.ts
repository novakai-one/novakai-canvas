import type {
  EditableRouteSegment, Point, RouteAxis, RouteObstacle, WireRouteEditRequest,
  WireRouteEditResult,
} from './contract.ts';
import { ROUTE_SNAP_DISTANCE } from './policy.ts';
import { normalizeRoute } from './polyline.ts';
import { routeWire } from './wire-router.ts';

function segmentAxis(from: Point, to: Point): RouteAxis | undefined {
  if (from.x === to.x && from.y !== to.y) return 'y';
  if (from.y === to.y && from.x !== to.x) return 'x';
  return undefined;
}

/** Internal route segments that can move without detaching an endpoint. */
export function editableRouteSegments(points: Point[]): EditableRouteSegment[] {
  const segments: EditableRouteSegment[] = [];
  for (let index = 1; index < points.length - 2; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const axis = segmentAxis(from, to);
    if (!axis) continue;
    segments.push({
      index,
      axis,
      from: { ...from },
      to: { ...to },
      midpoint: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    });
  }
  return segments;
}

function guideCoordinates(
  axis: RouteAxis,
  points: Point[],
  obstacles: RouteObstacle[],
): number[] {
  const values = points.map((point) => point[axis]);
  for (const { rect } of obstacles) {
    if (axis === 'x') values.push(rect.x, rect.x + rect.width / 2, rect.x + rect.width);
    else values.push(rect.y, rect.y + rect.height / 2, rect.y + rect.height);
  }
  return [...new Set(values)].sort((left, right) => left - right);
}

function snapCoordinate(
  value: number,
  axis: RouteAxis,
  request: WireRouteEditRequest,
): number {
  if (!request.snap.enabled) return value;
  const distance = request.snap.distance ?? ROUTE_SNAP_DISTANCE;
  const guide = guideCoordinates(axis, request.route.points, request.routeRequest.obstacles ?? [])
    .map((candidate) => ({ candidate, distance: Math.abs(candidate - value) }))
    .filter((candidate) => candidate.distance <= distance)
    .sort((left, right) => left.distance - right.distance || left.candidate - right.candidate)[0];
  if (guide) return guide.candidate;
  const grid = Math.max(1, request.snap.gridSize);
  return Math.round(value / grid) * grid;
}

function waypointsFor(points: Point[]): Point[] {
  return points.slice(1, -1).map((point) => ({ ...point }));
}

/**
 * Moves one route segment under shared snapping/collision policy.
 *
 * The caller may preview an invalid result, but must commit only when `valid` is true.
 */
export function reshapeRouteSegment(request: WireRouteEditRequest): WireRouteEditResult {
  let waypoints: Point[];
  if (request.segmentIndex === undefined) {
    waypoints = [{
      x: snapCoordinate(request.pointer.x, 'x', request),
      y: snapCoordinate(request.pointer.y, 'y', request),
    }];
  } else {
    const segment = editableRouteSegments(request.route.points)
      .find((candidate) => candidate.index === request.segmentIndex);
    if (!segment) return { route: request.route, waypoints: [], valid: false };
    const moved = request.route.points.map((point) => ({ ...point }));
    if (segment.axis === 'x') {
      const y = snapCoordinate(request.pointer.y, 'y', request);
      moved[segment.index].y = y;
      moved[segment.index + 1].y = y;
    } else {
      const x = snapCoordinate(request.pointer.x, 'x', request);
      moved[segment.index].x = x;
      moved[segment.index + 1].x = x;
    }
    waypoints = waypointsFor(normalizeRoute(moved));
  }
  const route = routeWire({ ...request.routeRequest, waypoints });
  return { route, waypoints, valid: route.collisions === 0 };
}
