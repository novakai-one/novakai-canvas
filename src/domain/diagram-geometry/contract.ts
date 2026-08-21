import type { WireId } from '../ids.ts';
import type { PortSide } from '../layout-record.ts';
import type { Position } from '../model.ts';

export type Point = Position;
export interface Rect { x: number; y: number; width: number; height: number }

/** Which edge of a node an endpoint leaves from or arrives at. */
export type RouteSide = PortSide;

/** A rectangle a routed wire should not cross. Group frames are soft obstacles. */
export interface RouteObstacle { rect: Rect; soft: boolean }

export interface WireRouteRequest {
  source: Point;
  sourceSide: RouteSide;
  target: Point;
  targetSide: RouteSide;
  obstacles?: RouteObstacle[];
  /** Deliberate human corridor points; the router obeys them in order. */
  waypoints?: Point[];
  /** Perpendicular offset for parallel wires sharing a node pair. */
  lane?: number;
  /** Optional interaction override; the domain policy owns the default. */
  stub?: number;
}

export interface WireRoute {
  points: Point[];
  collisions: number;
  softCollisions: number;
}

/** One transient visible-wire plan. Generated points never enter stored JSON. */
export interface PlannedWireRoute extends WireRoute {
  wireId: WireId;
  sourceSide: RouteSide;
  targetSide: RouteSide;
  obstacles: RouteObstacle[];
  lane: number;
}

export interface WirePlanOptions {
  avoidObstacles?: boolean;
}
