import type { NodeId } from '../ids.ts';
import type { CanvasNode, CanvasWire, LayoutStrategyName, NodePlacement } from '../records.ts';

/**
 * The layout seam.
 *
 * Every arrangement in Canvas is one pure function of `(graph, target, options)`. Nothing here
 * reads a clock, a file, or a renderer: given the same three arguments it returns the same
 * geometry, byte for byte, which is what lets a proposal be reviewed before it is saved and lets
 * a CLI and a browser agree about what a diagram looks like.
 *
 * A layout run also has a boundary. It may only move what its target names — the one exception
 * is that a group being laid out resizes to contain its own children, because a container that
 * cannot grow would clip them. Everything else keeps the placement object it already had.
 */

/**
 * Everything a layout run is allowed to see.
 *
 * Deliberately not a `DiagramRecord`: a strategy has no business reading a revision, a view, or
 * an applied operation, and taking only these three maps makes that impossible rather than
 * merely discouraged.
 */
export interface LayoutGraph {
  nodes: Record<string, CanvasNode>;
  wires: Record<string, CanvasWire>;
  placements: Record<string, NodePlacement>;
}

/**
 * Which part of a diagram one layout run may move.
 *
 * `nodes` is an explicit slice: the named nodes must share one container, because arranging
 * nodes drawn inside different boxes has no single coordinate space to arrange them in.
 */
export type LayoutSliceTarget =
  | { kind: 'diagram' }
  | { kind: 'group'; groupId: NodeId }
  | { kind: 'nodes'; nodeIds: NodeId[] };

/** Tuning for one layout run. Passed to the strategy in full so a result is reproducible. */
export interface LayoutOptions {
  strategy: LayoutStrategyName;
  /** Gap between two nodes sharing a rank. */
  nodeGap: number;
  /** Gap between one rank and the next. */
  rankGap: number;
  /** Padding a group keeps between its edge and its children. */
  groupPadding: number;
}

/** The options used when a caller names only the parts it cares about. */
export const defaultLayoutOptions: LayoutOptions = {
  strategy: 'hierarchy', nodeGap: 40, rankGap: 70, groupPadding: 40,
};

/**
 * A pure arrangement function.
 *
 * Returns a placement for each node it decided about, keyed by node id — never a whole diagram,
 * so a strategy cannot quietly express an opinion about geometry outside its target.
 */
export type LayoutStrategy = (
  graph: LayoutGraph,
  target: LayoutSliceTarget,
  options: LayoutOptions,
) => Record<string, NodePlacement>;

/**
 * The outcome of planning a slice layout.
 *
 * `rejected` means the target itself was not a legal slice; `failed` means it named nothing to
 * arrange. Both are values rather than exceptions: a host offering a layout button needs to say
 * why nothing happened, and a thrown string is not a thing it can render.
 */
export type LayoutPlan =
  | { status: 'planned'; placements: Record<string, NodePlacement>; affectedNodeIds: NodeId[] }
  | { status: 'rejected'; reason: 'mixed-parent-target' }
  | { status: 'failed'; reason: 'empty-target' | 'unknown-group' };
