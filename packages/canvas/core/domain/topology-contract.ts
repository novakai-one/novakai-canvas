import type { NodeId, WireId } from '../../contract/brands.ts';

/** How a boundary treats wires with exactly one endpoint inside. */
export type CrossingPolicy = 'gated' | 'free';

/** One group whose descendants are separated from the rest of the diagram. */
export interface Boundary { nodeId: NodeId; crossing: CrossingPolicy; gate?: NodeId }

/** One wire crossing one boundary. Nested boundaries can yield multiple entries per wire. */
export interface Crossing { wireId: WireId; boundaryId: NodeId; gateNodeId: NodeId | null }

/** The compiled topology of one diagram. */
export interface Topology {
  bands: ReadonlyMap<NodeId, number>;
  lanes: ReadonlyMap<NodeId, number>;
  boundaries: readonly Boundary[];
}

/** A rejected topology fact with enough location for adapters to report directly. */
export class TopologyError extends Error {
  readonly nodeId: string;
  readonly field: 'crossing' | 'gate' | 'anchor';
  readonly path: readonly (string | number)[];
  readonly input: unknown;

  constructor(
    message: string,
    nodeId: string,
    field: 'crossing' | 'gate' | 'anchor',
    path: readonly (string | number)[] = ['nodes', nodeId, field],
    input?: unknown,
  ) {
    super(message);
    this.name = 'TopologyError';
    this.nodeId = nodeId;
    this.field = field;
    this.path = path;
    this.input = input;
  }
}

/** The topology of a record that declares nothing. */
export const EMPTY_TOPOLOGY: Topology = {
  bands: new Map(), lanes: new Map(), boundaries: [],
};
