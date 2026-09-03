import type { WireRouteHint } from '../../../contract/records/layout.ts';
import { resolveAppearanceTokens } from '../../components/appearance.ts';
import type { ProjectedView, PositionedNode } from '../project-view.ts';
import type { PlannedWireRoute, WirePlanOptions } from './contract.ts';
import { routeWire } from './wire-router.ts';
import { anchorFor, type ShapedBox } from './anchor.ts';
import { chooseSides, laneOffsets, nodeRects, wireObstacles } from './view-geometry.ts';

/** One wire end's node with the geometry the router needs: its box and its outline shape. */
function shapedBox(node: PositionedNode, rect: ShapedBox['rect']): ShapedBox {
  return { rect, shape: resolveAppearanceTokens(node.appearance).shape };
}

/** Plans every visible wire once from committed geometry and deliberate route hints. */
export function planWireRoutes(
  view: ProjectedView,
  hints: Record<string, WireRouteHint>,
  options: WirePlanOptions,
): Record<string, PlannedWireRoute> {
  const rects = nodeRects(view);
  const nodes = new Map(view.nodes.map((node) => [node.id as string, node]));
  const lanes = laneOffsets(view.wires);
  const planned: Record<string, PlannedWireRoute> = {};
  for (const wire of view.wires) {
    const source = rects.get(wire.source.nodeId as string);
    const target = rects.get(wire.target.nodeId as string);
    const sourceNode = nodes.get(wire.source.nodeId as string);
    const targetNode = nodes.get(wire.target.nodeId as string);
    if (!source || !target || !sourceNode || !targetNode) continue;
    const obstacles = options.avoidObstacles === false
      ? [] : wireObstacles(view, rects, wire);
    const automatic = chooseSides(source, target, obstacles, options.axis);
    const hint = hints[wire.id];
    const sourceSide = wire.source.anchor?.side ?? hint?.preferredSourceSide ?? automatic.sourceSide;
    const targetSide = wire.target.anchor?.side ?? hint?.preferredTargetSide ?? automatic.targetSide;
    const lane = lanes.get(wire.id) ?? 0;
    const route = routeWire({
      source: anchorFor(
        wire.source, shapedBox(sourceNode, source), sourceSide,
        sourceNode.interfaceIds.length, sourceNode,
      ),
      sourceSide,
      target: anchorFor(
        wire.target, shapedBox(targetNode, target), targetSide,
        targetNode.interfaceIds.length, targetNode,
      ),
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
