import type { Point, WireRoute, WireRouteRequest } from './contract.ts';
import { ENDPOINT_EGRESS } from './policy.ts';
import {
  advance, isVertical, polylineLength, routeCollisions, simplify,
} from './polyline.ts';
import { routeCandidates } from './route-candidates.ts';

function score(route: WireRoute): number {
  return route.collisions * 1e9 + route.softCollisions * 1e6
    + polylineLength(route.points) + route.points.length * 40;
}

function waypointRoute(request: WireRouteRequest): Point[] {
  const stub = request.stub ?? ENDPOINT_EGRESS;
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

/** Deterministic orthogonal route selection shared by every host. */
export function routeWire(request: WireRouteRequest): WireRoute {
  const obstacles = request.obstacles ?? [];
  if (request.waypoints && request.waypoints.length > 0) {
    const points = simplify(waypointRoute(request));
    return { points, ...routeCollisions(points, obstacles) };
  }

  let best: WireRoute | null = null;
  for (const points of routeCandidates(request)) {
    const candidate = { points, ...routeCollisions(points, obstacles) };
    if (!best || score(candidate) < score(best)) best = candidate;
    if (best.collisions === 0 && best.softCollisions === 0) break;
  }
  return best ?? { points: [request.source, request.target], collisions: 0, softCollisions: 0 };
}
