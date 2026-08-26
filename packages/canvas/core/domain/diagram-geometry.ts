/** Public, framework-free authority for Canvas placement and wire geometry. */

export { layoutScopes } from './diagram-geometry/placement.ts';
export {
  reflowPresentation, reflowTopology, type PresentationReflowRequest,
} from './diagram-geometry/presentation-reflow.ts';
export { planWireRoutes } from './diagram-geometry/wire-plan.ts';
export { anchorFor } from './diagram-geometry/view-geometry.ts';
export { routeWire } from './diagram-geometry/wire-router.ts';
export {
  editableRouteSegments, reshapeRouteSegment,
} from './diagram-geometry/wire-route-edit.ts';
export {
  nearestPositionAlong, normalizeRoute, pointAlong, polylineLength, routeCollisions, routePath,
  segmentIntersectsRect, simplify,
} from './diagram-geometry/polyline.ts';
export {
  chooseSides, facingSides, laneOffsets, nodeRects, wireObstacles,
} from './diagram-geometry/view-geometry.ts';
export type {
  PlannedWireRoute, Point, Rect, RouteObstacle, RouteSide, WireRoute, WireRouteRequest,
  EditableRouteSegment, RouteAxis, RouteSnapPolicy, WirePlanOptions, WireRouteEditRequest,
  WireRouteEditResult,
} from './diagram-geometry/contract.ts';
