/** The frame a diagram declares for itself: which band and lane each node occupies. */

import type { NodeId } from './ids.ts';

/** The compiled form of one diagram's declared bands and lanes. */
export interface Topology {
  /** Declared along-axis rank per node; an absent node falls through to the engine's ranking. */
  bands: ReadonlyMap<NodeId, number>;
  /** Declared across-axis column per node; an absent node floats within its band. */
  lanes: ReadonlyMap<NodeId, number>;
}

/** The topology of a record that declares nothing: layout behaves exactly as if absent. */
export const EMPTY_TOPOLOGY: Topology = { bands: new Map(), lanes: new Map() };

/**
 * Compiles the declared frame from any node map carrying the optional ordinals —
 * record nodes and document nodes share the shape, so both hosts compile here.
 * Pure: validates nothing (shape rejection is the schema's job) and reads no ambient state.
 */
export function compileTopology(
  nodes: Readonly<Record<string, { band?: number; lane?: number }>>,
): Topology {
  const bands = new Map<NodeId, number>();
  const lanes = new Map<NodeId, number>();
  for (const [id, node] of Object.entries(nodes)) {
    if (node.band !== undefined) bands.set(id as NodeId, node.band);
    if (node.lane !== undefined) lanes.set(id as NodeId, node.lane);
  }
  if (bands.size === 0 && lanes.size === 0) return EMPTY_TOPOLOGY;
  return { bands, lanes };
}

/** Whether a topology declares anything — the inertness check every layout caller makes. */
export function isEmptyTopology(topology: Topology): boolean {
  return topology.bands.size === 0 && topology.lanes.size === 0;
}
