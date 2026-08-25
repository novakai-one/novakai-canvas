/** Selecting stable node sets from a layout graph. */

import type { NodeId } from '../ids.ts';
import type { LayoutGraph } from './contract.ts';

/** Direct children of one container, sorted by identity. */
export function childIdsOf(graph: LayoutGraph, containerId: string | undefined): string[] {
  return Object.keys(graph.nodes)
    .filter((id) => (graph.nodes[id].parentId ?? undefined) === containerId)
    .sort();
}

/** All descendants of one container, sorted by identity. */
export function containedIdsOf(graph: LayoutGraph, containerId: string): string[] {
  const inside = childIdsOf(graph, containerId);
  for (let index = 0; index < inside.length; index += 1) {
    for (const id of childIdsOf(graph, inside[index])) inside.push(id);
  }
  return inside.sort();
}

/** Unique, existing, sorted ids from an explicit node selection. */
export function namedIdsOf(graph: LayoutGraph, nodeIds: readonly NodeId[]): string[] {
  return [...new Set<string>(nodeIds)].filter((id) => graph.nodes[id]).sort();
}
