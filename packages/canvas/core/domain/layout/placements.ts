/** Preparing and reading the mutable placement set used by one layout proposal. */

import type { NodeId } from '../../../contract/brands.ts';
import type { NodePlacement } from '../../../contract/records/index.ts';
import type { Position } from '../../../contract/types/spatial.ts';
import type { LayoutGraph } from './contract.ts';

const FALLBACK_PLACEMENT: Omit<NodePlacement, 'nodeId'> = {
  position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, pinned: false,
};

function placementOf(graph: LayoutGraph, nodeId: string): NodePlacement {
  return graph.placements[nodeId]
    ?? { nodeId: nodeId as NodeId, ...structuredClone(FALLBACK_PLACEMENT) };
}

/** A deterministic working copy containing every semantic node. */
export function workingPlacements(graph: LayoutGraph): Map<string, NodePlacement> {
  return new Map(Object.keys(graph.nodes).sort().map((id) => [id, placementOf(graph, id)]));
}

/** The upper-left origin of a non-empty placement selection. */
export function topLeftOf(ids: string[], working: Map<string, NodePlacement>): Position {
  const positions = ids.map((id) => (working.get(id) as NodePlacement).position);
  return {
    x: Math.min(...positions.map((position) => position.x)),
    y: Math.min(...positions.map((position) => position.y)),
  };
}
