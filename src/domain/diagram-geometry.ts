/** Public, framework-free authority for Canvas placement and wire geometry. */

export { layoutScopes } from './diagram-geometry/placement.ts';
export { planWireRoutes } from './diagram-geometry/wire-plan.ts';
export { routeWire } from './diagram-geometry/wire-router.ts';
export {
  nearestPositionAlong, pointAlong, polylineLength, routeCollisions, routePath,
  segmentIntersectsRect, simplify,
} from './diagram-geometry/polyline.ts';
export {
  chooseSides, facingSides, laneOffsets, nodeRects, wireObstacles,
} from './diagram-geometry/view-geometry.ts';
export type {
  PlannedWireRoute, Point, Rect, RouteObstacle, RouteSide, WireRoute, WireRouteRequest,
  WirePlanOptions,
} from './diagram-geometry/contract.ts';
