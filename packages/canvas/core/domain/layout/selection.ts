/** Selecting stable node sets from a layout graph. */

import type { NodeId } from '../../../contract/brands.ts';
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

/**
 * Maps every node to the nearest of the given siblings on its parent chain — itself included.
 * Lets a wire between two groups' members count as a wire between the groups themselves.
 */
export function rollupToSiblings(
  graph: LayoutGraph,
  siblingIds: readonly string[],
): ReadonlyMap<string, string> {
  const siblings = new Set(siblingIds);
  const rollup = new Map<string, string>();
  for (const id of Object.keys(graph.nodes)) {
    let cursor: string | undefined = id;
    const seen = new Set<string>();
    while (cursor !== undefined && !seen.has(cursor) && !siblings.has(cursor)) {
      seen.add(cursor);
      cursor = graph.nodes[cursor]?.parentId ?? undefined;
    }
    if (cursor !== undefined && siblings.has(cursor)) rollup.set(id, cursor);
  }
  return rollup;
}
