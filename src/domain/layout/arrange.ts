/** Packing a slice: containers bottom-up, named nodes against each other. */

import type { Position } from '../spatial.ts';
import type { NodePlacement } from '../records.ts';
import type { LayoutGraph, LayoutOptions, LayoutSliceTarget } from './contract.ts';
import {
  childIdsOf, containedIdsOf, namedIdsOf, topLeftOf, workingPlacements,
} from './graph.ts';
import { rankedPositions, sizeContaining } from './rank.ts';

/** Extra top padding inside a group, leaving room for its title. */
const GROUP_TITLE_SPACE = 16;

/**
 * Arranges one container's children, deepest container first.
 *
 * Bottom-up because a group has to know how big it is before the container holding it can pack
 * it against its siblings. Child positions are relative to their container, so re-packing the
 * inside of a group never disturbs a coordinate outside it.
 */
function arrangeContainer(
  graph: LayoutGraph,
  containerId: string | undefined,
  working: Map<string, NodePlacement>,
  options: LayoutOptions,
  mayResizeContainer: boolean,
): void {
  const childIds = childIdsOf(graph, containerId);
  if (childIds.length === 0) return;
  for (const childId of childIds) {
    if (graph.nodes[childId].kind === 'group') {
      arrangeContainer(graph, childId, working, options, true);
    }
  }

  const movableIds = childIds.filter((id) => !(working.get(id) as NodePlacement).pinned);
  if (movableIds.length > 0) {
    // Top-level content keeps the corner it already occupies; a group's children start inside it.
    const origin = containerId === undefined
      ? topLeftOf(movableIds, working)
      : { x: options.groupPadding, y: options.groupPadding + GROUP_TITLE_SPACE };
    const ranked = rankedPositions(graph, movableIds, working, options);
    for (const id of movableIds) {
      const placement = working.get(id) as NodePlacement;
      const position = ranked.get(id) as Position;
      working.set(id, {
        ...placement,
        position: { x: origin.x + position.x, y: origin.y + position.y },
      });
    }
  }

  if (containerId === undefined || !mayResizeContainer) return;
  const container = working.get(containerId) as NodePlacement;
  if (container.pinned) return;
  working.set(containerId, { ...container, size: sizeContaining(childIds, working, options) });
}

/** Arranges exactly the named nodes against each other, leaving the block where it already is. */
function arrangeNamedNodes(
  graph: LayoutGraph,
  ids: string[],
  working: Map<string, NodePlacement>,
  options: LayoutOptions,
): void {
  const movableIds = ids.filter((id) => !(working.get(id) as NodePlacement).pinned);
  // One movable node has nothing to be arranged against, so there is no arrangement to propose.
  if (movableIds.length < 2) return;

  const origin = topLeftOf(movableIds, working);
  const ranked = rankedPositions(graph, movableIds, working, options);
  for (const id of movableIds) {
    const placement = working.get(id) as NodePlacement;
    const position = ranked.get(id) as Position;
    working.set(id, { ...placement, position: { x: origin.x + position.x, y: origin.y + position.y } });
  }
}

/** Node ids one target permits a strategy to write, in sorted order. */
export function targetNodeIds(graph: LayoutGraph, target: LayoutSliceTarget): string[] {
  if (target.kind === 'diagram') return Object.keys(graph.nodes).sort();
  if (target.kind === 'group') return [target.groupId as string, ...containedIdsOf(graph, target.groupId)].sort();
  return namedIdsOf(graph, target.nodeIds);
}

function placementsFor(ids: string[], working: Map<string, NodePlacement>): Record<string, NodePlacement> {
  const placements: Record<string, NodePlacement> = {};
  for (const id of [...ids].sort()) placements[id] = working.get(id) as NodePlacement;
  return placements;
}

export function arrangeSlice(
  graph: LayoutGraph,
  target: LayoutSliceTarget,
  options: LayoutOptions,
): Record<string, NodePlacement> {
  const working = workingPlacements(graph);
  if (target.kind === 'nodes') {
    arrangeNamedNodes(graph, namedIdsOf(graph, target.nodeIds), working, options);
  } else if (target.kind === 'group') {
    arrangeContainer(graph, target.groupId, working, options, true);
  } else {
    arrangeContainer(graph, undefined, working, options, false);
  }
  return placementsFor(targetNodeIds(graph, target), working);
}
