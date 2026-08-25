/** Pure compilation and queries for a diagram's declared topology. */

import type { NodeId, WireId } from './ids.ts';
import type { DiagramRecord } from './records.ts';

/** How a boundary treats wires with exactly one endpoint inside. */
export type CrossingPolicy = 'gated' | 'free';

/** One group whose descendants are separated from the rest of the diagram. */
export interface Boundary {
  nodeId: NodeId;
  crossing: CrossingPolicy;
  gate?: NodeId;
}

/** One wire crossing one boundary. Nested boundaries can yield multiple entries per wire. */
export interface Crossing {
  wireId: WireId;
  boundaryId: NodeId;
  gateNodeId: NodeId | null;
}

/** The compiled topology of one diagram. */
export interface Topology {
  bands: ReadonlyMap<NodeId, number>;
  lanes: ReadonlyMap<NodeId, number>;
  boundaries: readonly Boundary[];
}

interface TopologyNode {
  id?: string;
  label?: string;
  kind?: string;
  parentId?: string;
  band?: number;
  lane?: number;
  crossing?: CrossingPolicy;
  gate?: string;
}

type TopologyNodes = Readonly<Record<string, TopologyNode>>;

/** A rejected topology fact, with enough location for adapters to report without revalidating. */
export class TopologyError extends Error {
  readonly nodeId: string;
  readonly field: 'crossing' | 'gate';

  constructor(
    message: string,
    nodeId: string,
    field: 'crossing' | 'gate',
  ) {
    super(message);
    this.name = 'TopologyError';
    this.nodeId = nodeId;
    this.field = field;
  }
}

/** The topology of a record that declares nothing. */
export const EMPTY_TOPOLOGY: Topology = {
  bands: new Map(), lanes: new Map(), boundaries: [],
};

function inside(nodes: TopologyNodes, nodeId: string, boundaryId: string): boolean {
  let cursor = nodes[nodeId]?.parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === boundaryId) return true;
    seen.add(cursor);
    cursor = nodes[cursor]?.parentId;
  }
  return false;
}

function boundaryFor(nodes: TopologyNodes, nodeId: string, node: TopologyNode): Boundary | undefined {
  if (node.crossing === undefined && node.gate === undefined) return undefined;
  const label = node.label ?? nodeId;
  if (node.kind !== 'group' && node.kind !== 'scope') {
    throw new TopologyError(
      `crossing belongs on a zone, not on ${node.kind ?? 'node'}`, nodeId, 'crossing',
    );
  }
  if (node.crossing === undefined) {
    throw new TopologyError(`zone "${label}": gate requires crossing=gated`, nodeId, 'gate');
  }
  if (node.crossing === 'gated' && node.gate === undefined) {
    throw new TopologyError(
      `zone "${label}": crossing=gated needs gate="<node label>"`, nodeId, 'gate',
    );
  }
  if (node.crossing === 'free' && node.gate !== undefined) {
    throw new TopologyError(
      `zone "${label}": crossing=free cannot have a gate`, nodeId, 'gate',
    );
  }
  if (node.gate !== undefined && !nodes[node.gate]) {
    throw new TopologyError(
      `zone "${label}": gate "${node.gate}" does not exist`, nodeId, 'gate',
    );
  }
  if (node.gate !== undefined && !inside(nodes, node.gate, nodeId)) {
    const gateLabel = nodes[node.gate]?.label ?? node.gate;
    throw new TopologyError(
      `zone "${label}": gate "${gateLabel}" is not inside this zone`, nodeId, 'gate',
    );
  }
  return {
    nodeId: nodeId as NodeId,
    crossing: node.crossing,
    ...(node.gate === undefined ? {} : { gate: node.gate as NodeId }),
  };
}

function compile(nodes: TopologyNodes, includeBoundaries: boolean): Topology {
  const bands = new Map<NodeId, number>();
  const lanes = new Map<NodeId, number>();
  const boundaries: Boundary[] = [];
  for (const [id, node] of Object.entries(nodes).sort(([left], [right]) => left.localeCompare(right))) {
    if (node.band !== undefined) bands.set(id as NodeId, node.band);
    if (node.lane !== undefined) lanes.set(id as NodeId, node.lane);
    if (!includeBoundaries) continue;
    const boundary = boundaryFor(nodes, id, node);
    if (boundary) boundaries.push(boundary);
  }
  if (bands.size === 0 && lanes.size === 0 && boundaries.length === 0) return EMPTY_TOPOLOGY;
  return { bands, lanes, boundaries };
}

/** Compiles durable node facts and rejects invalid boundary references in one authority. */
export function compileTopology(nodes: TopologyNodes): Topology {
  return compile(nodes, true);
}

/**
 * Compiles only geometry facts while an atomic command batch is assembling parent-first nodes.
 * Boundaries never affect placement; final records still pass through `compileTopology`.
 */
export function compileFrameTopology(nodes: TopologyNodes): Topology {
  return compile(nodes, false);
}

/** Whether a topology declares anything. */
export function isEmptyTopology(topology: Topology): boolean {
  return topology.bands.size === 0 && topology.lanes.size === 0 && topology.boundaries.length === 0;
}

/** Whether the node is a strict descendant of the boundary group. */
export function isInside(
  record: Pick<DiagramRecord, 'nodes'>,
  nodeId: NodeId,
  boundaryId: NodeId,
): boolean {
  return inside(record.nodes, nodeId as string, boundaryId as string);
}

/** Returns a boundary's gate, or throws when the caller names no compiled boundary. */
export function gateOf(topology: Topology, boundaryId: NodeId): NodeId | null {
  const boundary = topology.boundaries.find((item) => item.nodeId === boundaryId);
  if (!boundary) throw new RangeError(`unknown boundary "${boundaryId}"`);
  return boundary.gate ?? null;
}

/** Reports every wire/boundary pair with exactly one endpoint inside; never rejects or reroutes. */
export function crossingsOf(record: DiagramRecord, topology: Topology): readonly Crossing[] {
  const crossings: Crossing[] = [];
  const wires = Object.values(record.wires)
    .sort((left, right) => (left.id as string).localeCompare(right.id as string));
  for (const boundary of topology.boundaries) {
    for (const wire of wires) {
      const sourceInside = isInside(record, wire.source.nodeId, boundary.nodeId);
      const targetInside = isInside(record, wire.target.nodeId, boundary.nodeId);
      if (sourceInside === targetInside) continue;
      const insideEndpoint = sourceInside ? wire.source.nodeId : wire.target.nodeId;
      crossings.push({
        wireId: wire.id,
        boundaryId: boundary.nodeId,
        gateNodeId: boundary.gate === insideEndpoint ? boundary.gate : null,
      });
    }
  }
  return crossings;
}
