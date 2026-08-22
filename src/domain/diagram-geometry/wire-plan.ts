import type { WireRouteHint } from '../layout-record.ts';
import type { ProjectedView } from '../project-view.ts';
import type { PlannedWireRoute, WirePlanOptions } from './contract.ts';
import { routeWire } from './wire-router.ts';
import {
  attachmentPoint, chooseSides, laneOffsets, nodeRects, wireObstacles,
} from './view-geometry.ts';

/** Plans every visible wire once from committed geometry and deliberate route hints. */
export function planWireRoutes(
  view: ProjectedView,
  hints: Record<string, WireRouteHint>,
  options: WirePlanOptions = {},
): Record<string, PlannedWireRoute> {
  const rects = nodeRects(view);
  const lanes = laneOffsets(view.wires);
  const planned: Record<string, PlannedWireRoute> = {};
  for (const wire of view.wires) {
    const source = rects.get(wire.source.nodeId as string);
    const target = rects.get(wire.target.nodeId as string);
    if (!source || !target) continue;
    const obstacles = options.avoidObstacles === false
      ? [] : wireObstacles(view, rects, wire);
    const automatic = chooseSides(source, target, obstacles);
    const hint = hints[wire.id];
    const sourceSide = hint?.preferredSourceSide ?? automatic.sourceSide;
    const targetSide = hint?.preferredTargetSide ?? automatic.targetSide;
    const lane = lanes.get(wire.id) ?? 0;
    const route = routeWire({
      source: attachmentPoint(source, sourceSide),
      sourceSide,
      target: attachmentPoint(target, targetSide),
      targetSide,
      obstacles,
      waypoints: hint?.waypoints,
      lane,
    });
    planned[wire.id] = {
      wireId: wire.id,
      sourceSide,
      targetSide,
      obstacles,
      lane,
      ...route,
    };
  }
  return planned;
}
