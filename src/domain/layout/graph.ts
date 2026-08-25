/** Reading a layout graph: what is inside what, and where it currently sits. */

import type { LayoutId, NodeId } from '../ids.ts';
import type { Position } from '../spatial.ts';
import type { DiagramRecord, NodePlacement } from '../records.ts';
import type { LayoutGraph } from './contract.ts';

const FALLBACK_PLACEMENT: Omit<NodePlacement, 'nodeId'> = {
  position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, pinned: false,
};

function placementOf(graph: LayoutGraph, nodeId: string): NodePlacement {
  return graph.placements[nodeId]
    ?? { nodeId: nodeId as NodeId, ...structuredClone(FALLBACK_PLACEMENT) };
}

export function workingPlacements(graph: LayoutGraph): Map<string, NodePlacement> {
  return new Map(Object.keys(graph.nodes).sort().map((id) => [id, placementOf(graph, id)]));
}

export function childIdsOf(graph: LayoutGraph, containerId: string | undefined): string[] {
  return Object.keys(graph.nodes)
    .filter((id) => (graph.nodes[id].parentId ?? undefined) === containerId)
    .sort();
}

export function containedIdsOf(graph: LayoutGraph, containerId: string): string[] {
  const inside = childIdsOf(graph, containerId);
  for (let index = 0; index < inside.length; index += 1) {
    for (const id of childIdsOf(graph, inside[index])) inside.push(id);
  }
  return inside.sort();
}

/** Unique, existing, sorted — so the same request never depends on how a caller spelled it. */
export function namedIdsOf(graph: LayoutGraph, nodeIds: readonly NodeId[]): string[] {
  return [...new Set<string>(nodeIds)].filter((id) => graph.nodes[id]).sort();
}

export function topLeftOf(ids: string[], working: Map<string, NodePlacement>): Position {
  const positions = ids.map((id) => (working.get(id) as NodePlacement).position);
  return {
    x: Math.min(...positions.map((position) => position.x)),
    y: Math.min(...positions.map((position) => position.y)),
  };
}

/** Reads one saved layout of a record as a layout graph, defaulting to the active view's. */
export function graphOfDiagram(record: DiagramRecord, layoutId?: LayoutId): LayoutGraph {
  const resolvedId = layoutId ?? record.views[record.activeViewId]?.layoutId;
  const layout = resolvedId === undefined ? undefined : record.layouts[resolvedId];
  if (!layout) throw new Error(`unknown-layout:${resolvedId ?? ''}`);
  return { nodes: record.nodes, wires: record.wires, placements: layout.placements };
}
