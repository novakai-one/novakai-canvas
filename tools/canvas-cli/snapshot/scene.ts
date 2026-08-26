import type { DiagramRecord } from '../../../src/domain/records.ts';
import { orientationOf, resolveAxis } from '../../../src/domain/axis.ts';
import { planWireRoutes } from '../../../src/domain/diagram-geometry.ts';
import { projectView } from '../../../src/domain/project-view.ts';
import { compileTopology, crossingsOf } from '../../../src/domain/topology.ts';
import { placedNodes, rootGroupId, type PlacedNode } from '../record-graph.ts';
import type { SnapshotScene } from './contract.ts';
import { SNAPSHOT_STYLE } from './svg.ts';
import { compileFlows, wireEmphasis } from '../../../src/domain/flows.ts';

interface Point { x: number; y: number }

function descendantsOf(nodes: Record<string, PlacedNode>, scopeId: string): PlacedNode[] {
  const descendants: PlacedNode[] = [];
  const collect = (parentId: string): void => {
    const children = Object.values(nodes)
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => (a.id as string).localeCompare(b.id as string));
    for (const child of children) {
      descendants.push(child);
      collect(child.id as string);
    }
  };
  collect(scopeId);
  return descendants;
}

function positionResolver(
  nodes: Record<string, PlacedNode>,
  scopeId: string,
  panel: SnapshotScene['panel'],
): (id: string) => Point {
  return (id: string): Point => {
    let x = panel.x + nodes[id].position.x;
    let y = panel.y + nodes[id].position.y;
    let parentId = nodes[id].parentId as string | undefined;
    while (parentId && parentId !== scopeId) {
      x += nodes[parentId].position.x;
      y += nodes[parentId].position.y;
      parentId = nodes[parentId].parentId as string | undefined;
    }
    return { x, y };
  };
}

/** Projects one record into the ordered, absolute geometry required by SVG rendering. */
export function buildSnapshotScene(record: DiagramRecord): SnapshotScene {
  const nodes = placedNodes(record);
  const scopeId = rootGroupId(record);
  if (!scopeId) throw new Error(`"${record.id}" has no single root group to render`);
  const scope = nodes[scopeId];
  const layout = record.layouts[record.views[record.activeViewId].layoutId];
  const view = projectView(record);
  const descendants = descendantsOf(nodes, scopeId);
  const descendantIds = new Set(descendants.map((node) => node.id as string));
  const wires = Object.values(record.wires)
    .filter((wire) => descendantIds.has(wire.source.nodeId as string)
      && descendantIds.has(wire.target.nodeId as string))
    .sort((a, b) => (a.id as string).localeCompare(b.id as string));
  const margin = SNAPSHOT_STYLE.margin;
  const panel = { x: margin, y: margin, width: scope.size.width, height: scope.size.height };
  const total = { width: panel.width + 2 * margin, height: panel.height + 2 * margin };
  const routes = planWireRoutes(view, layout.wireRouteHints, {
    axis: resolveAxis(orientationOf(record)), avoidObstacles: true,
  });
  const routeOffset = { x: panel.x - scope.position.x, y: panel.y - scope.position.y };
  const topology = compileTopology(record);
  const flows = compileFlows(record);
  const activeFlowId = record.views[record.activeViewId]?.flowId;
  const emphasis = wireEmphasis(flows, activeFlowId, wires.map((wire) => wire.id));
  return {
    nodes, scopeId, scope, layout, descendants, wires, panel, total, routes, routeOffset,
    topology, crossings: crossingsOf(record, topology),
    flows, activeFlowId, emphasis,
    positionOf: positionResolver(nodes, scopeId, panel),
  };
}
