import dagre from '@dagrejs/dagre';
import type { LayoutId, NodeId } from './ids.ts';
import type { Position } from './spatial.ts';
import type {
  CanvasNode, CanvasWire, DiagramRecord, LayoutStrategyName, NodePlacement,
} from './records.ts';

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

/** Extra top padding inside a group, leaving room for its title. */
const GROUP_TITLE_SPACE = 16;
const MIN_GROUP_SIZE = { width: 320, height: 160 };
const FALLBACK_PLACEMENT: Omit<NodePlacement, 'nodeId'> = {
  position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, pinned: false,
};

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

function placementOf(graph: LayoutGraph, nodeId: string): NodePlacement {
  return graph.placements[nodeId]
    ?? { nodeId: nodeId as NodeId, ...structuredClone(FALLBACK_PLACEMENT) };
}

function workingPlacements(graph: LayoutGraph): Map<string, NodePlacement> {
  return new Map(Object.keys(graph.nodes).sort().map((id) => [id, placementOf(graph, id)]));
}

function childIdsOf(graph: LayoutGraph, containerId: string | undefined): string[] {
  return Object.keys(graph.nodes)
    .filter((id) => (graph.nodes[id].parentId ?? undefined) === containerId)
    .sort();
}

function containedIdsOf(graph: LayoutGraph, containerId: string): string[] {
  const inside = childIdsOf(graph, containerId);
  for (let index = 0; index < inside.length; index += 1) {
    for (const id of childIdsOf(graph, inside[index])) inside.push(id);
  }
  return inside.sort();
}

/** Unique, existing, sorted — so the same request never depends on how a caller spelled it. */
function namedIdsOf(graph: LayoutGraph, nodeIds: readonly NodeId[]): string[] {
  return [...new Set<string>(nodeIds)].filter((id) => graph.nodes[id]).sort();
}

function topLeftOf(ids: string[], working: Map<string, NodePlacement>): Position {
  const positions = ids.map((id) => (working.get(id) as NodePlacement).position);
  return {
    x: Math.min(...positions.map((position) => position.x)),
    y: Math.min(...positions.map((position) => position.y)),
  };
}

/**
 * Ranks the given siblings with dagre and returns positions relative to the block's top-left.
 *
 * The caller decides where that block lands, which is what keeps a slice from teleporting to the
 * origin of its container.
 */
function rankedPositions(
  graph: LayoutGraph,
  ids: string[],
  working: Map<string, NodePlacement>,
  options: LayoutOptions,
  rankDirection: 'TB' | 'LR',
): Map<string, Position> {
  const ranked = new dagre.graphlib.Graph();
  ranked.setGraph({ rankdir: rankDirection, nodesep: options.nodeGap, ranksep: options.rankGap });
  ranked.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) {
    const { size } = working.get(id) as NodePlacement;
    ranked.setNode(id, { width: size.width, height: size.height });
  }

  const within = new Set(ids);
  for (const wireId of Object.keys(graph.wires).sort()) {
    const wire = graph.wires[wireId];
    const source = wire.source.nodeId as string;
    const target = wire.target.nodeId as string;
    if (source !== target && within.has(source) && within.has(target)) ranked.setEdge(source, target);
  }
  dagre.layout(ranked);

  const corners = ids.map((id) => {
    const laid = ranked.node(id);
    return { id, x: laid.x - laid.width / 2, y: laid.y - laid.height / 2 };
  });
  const left = Math.min(...corners.map((corner) => corner.x));
  const top = Math.min(...corners.map((corner) => corner.y));
  return new Map(corners.map((corner) => [corner.id, {
    x: Math.round(corner.x - left), y: Math.round(corner.y - top),
  }]));
}

function sizeContaining(childIds: string[], working: Map<string, NodePlacement>, options: LayoutOptions) {
  let right = 0;
  let bottom = 0;
  for (const id of childIds) {
    const { position, size } = working.get(id) as NodePlacement;
    right = Math.max(right, position.x + size.width);
    bottom = Math.max(bottom, position.y + size.height);
  }
  return {
    width: Math.max(MIN_GROUP_SIZE.width, right + options.groupPadding),
    height: Math.max(MIN_GROUP_SIZE.height, bottom + options.groupPadding),
  };
}

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
  rankDirection: 'TB' | 'LR',
  mayResizeContainer: boolean,
): void {
  const childIds = childIdsOf(graph, containerId);
  if (childIds.length === 0) return;
  for (const childId of childIds) {
    if (graph.nodes[childId].kind === 'group') {
      arrangeContainer(graph, childId, working, options, rankDirection, true);
    }
  }

  const movableIds = childIds.filter((id) => !(working.get(id) as NodePlacement).pinned);
  if (movableIds.length > 0) {
    // Top-level content keeps the corner it already occupies; a group's children start inside it.
    const origin = containerId === undefined
      ? topLeftOf(movableIds, working)
      : { x: options.groupPadding, y: options.groupPadding + GROUP_TITLE_SPACE };
    const ranked = rankedPositions(graph, movableIds, working, options, rankDirection);
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
  rankDirection: 'TB' | 'LR',
): void {
  const movableIds = ids.filter((id) => !(working.get(id) as NodePlacement).pinned);
  // One movable node has nothing to be arranged against, so there is no arrangement to propose.
  if (movableIds.length < 2) return;

  const origin = topLeftOf(movableIds, working);
  const ranked = rankedPositions(graph, movableIds, working, options, rankDirection);
  for (const id of movableIds) {
    const placement = working.get(id) as NodePlacement;
    const position = ranked.get(id) as Position;
    working.set(id, { ...placement, position: { x: origin.x + position.x, y: origin.y + position.y } });
  }
}

/** Node ids one target permits a strategy to write, in sorted order. */
function targetNodeIds(graph: LayoutGraph, target: LayoutSliceTarget): string[] {
  if (target.kind === 'diagram') return Object.keys(graph.nodes).sort();
  if (target.kind === 'group') return [target.groupId as string, ...containedIdsOf(graph, target.groupId)].sort();
  return namedIdsOf(graph, target.nodeIds);
}

function placementsFor(ids: string[], working: Map<string, NodePlacement>): Record<string, NodePlacement> {
  const placements: Record<string, NodePlacement> = {};
  for (const id of [...ids].sort()) placements[id] = working.get(id) as NodePlacement;
  return placements;
}

function arrangeSlice(
  graph: LayoutGraph,
  target: LayoutSliceTarget,
  options: LayoutOptions,
  rankDirection: 'TB' | 'LR',
): Record<string, NodePlacement> {
  const working = workingPlacements(graph);
  if (target.kind === 'nodes') {
    arrangeNamedNodes(graph, namedIdsOf(graph, target.nodeIds), working, options, rankDirection);
  } else if (target.kind === 'group') {
    arrangeContainer(graph, target.groupId, working, options, rankDirection, true);
  } else {
    arrangeContainer(graph, undefined, working, options, rankDirection, false);
  }
  return placementsFor(targetNodeIds(graph, target), working);
}

const strategies: Record<LayoutStrategyName, LayoutStrategy> = {
  // The identity strategy: a hand-placed diagram is a decision, and honouring it is a feature.
  manual: () => ({}),
  hierarchy: (graph, target, options) => arrangeSlice(graph, target, options, 'TB'),
  flow: (graph, target, options) => arrangeSlice(graph, target, options, 'LR'),
};

/** Resolves one named strategy. Every name in the record model has an implementation. */
export function layoutStrategyFor(name: LayoutStrategyName): LayoutStrategy {
  return strategies[name];
}

/** Reads one saved layout of a record as a layout graph, defaulting to the active view's. */
export function graphOfDiagram(record: DiagramRecord, layoutId?: LayoutId): LayoutGraph {
  const resolvedId = layoutId ?? record.views[record.activeViewId]?.layoutId;
  const layout = resolvedId === undefined ? undefined : record.layouts[resolvedId];
  if (!layout) throw new Error(`unknown-layout:${resolvedId ?? ''}`);
  return { nodes: record.nodes, wires: record.wires, placements: layout.placements };
}

function targetProblem(graph: LayoutGraph, target: LayoutSliceTarget): LayoutPlan | undefined {
  if (target.kind === 'diagram') {
    return Object.keys(graph.nodes).length === 0 ? { status: 'failed', reason: 'empty-target' } : undefined;
  }
  if (target.kind === 'group') {
    const group = graph.nodes[target.groupId];
    if (!group || group.kind !== 'group') return { status: 'failed', reason: 'unknown-group' };
    return childIdsOf(graph, target.groupId).length === 0
      ? { status: 'failed', reason: 'empty-target' }
      : undefined;
  }
  const ids = namedIdsOf(graph, target.nodeIds);
  if (ids.length === 0) return { status: 'failed', reason: 'empty-target' };
  const containerIds = new Set(ids.map((id) => graph.nodes[id].parentId ?? null));
  return containerIds.size === 1 ? undefined : { status: 'rejected', reason: 'mixed-parent-target' };
}

/**
 * Plans a layout over one slice of a diagram without applying it.
 *
 * The returned `placements` is the whole layout, not a fragment, so a caller can save it in one
 * write. Every node outside the target keeps the exact placement object it came in with: the
 * promise "nothing outside the slice moved" is upheld by construction here, not by hoping each
 * strategy remembers it.
 */
export function planSliceLayout(
  graph: LayoutGraph,
  target: LayoutSliceTarget,
  options: Partial<LayoutOptions> = {},
): LayoutPlan {
  const problem = targetProblem(graph, target);
  if (problem) return problem;

  const resolved: LayoutOptions = { ...defaultLayoutOptions, ...options };
  const proposed = layoutStrategyFor(resolved.strategy)(graph, target, resolved);
  const permitted = new Set(targetNodeIds(graph, target));
  for (const nodeId of Object.keys(proposed)) {
    // A strategy reaching outside its target is a defect in the strategy, not a policy choice.
    if (!permitted.has(nodeId)) throw new Error(`layout-outside-target:${nodeId}`);
  }

  const placements: Record<string, NodePlacement> = {};
  const affectedNodeIds: NodeId[] = [];
  for (const [nodeId, placement] of Object.entries(graph.placements)) {
    const next = proposed[nodeId];
    const changed = next !== undefined && JSON.stringify(next) !== JSON.stringify(placement);
    if (changed) affectedNodeIds.push(nodeId as NodeId);
    placements[nodeId] = changed ? next : placement;
  }
  for (const [nodeId, placement] of Object.entries(proposed)) {
    if (nodeId in graph.placements) continue;
    placements[nodeId] = placement;
    affectedNodeIds.push(nodeId as NodeId);
  }

  return { status: 'planned', placements, affectedNodeIds: affectedNodeIds.sort() };
}
