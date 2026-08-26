/** Resolving a strategy, judging a target, and planning one slice without applying it. */

import { resolveAxis } from '../axis.ts';
import type { NodeId } from '../../../contract/brands.ts';
import type { LayoutStrategyName, NodePlacement } from '../../../contract/records/index.ts';
import {
  defaultLayoutOptions,
  type LayoutGraph, type LayoutOptions, type LayoutPlan, type LayoutSliceTarget,
  type LayoutStrategy,
} from './contract.ts';
import { childIdsOf, namedIdsOf } from './selection.ts';
import { arrangeSlice, targetNodeIds } from './arrange.ts';

const strategies: Record<LayoutStrategyName, LayoutStrategy> = {
  // The identity strategy: a hand-placed diagram is a decision, and honouring it is a feature.
  manual: () => ({}),
  // Each named strategy keeps its own historical axis; the record's orientation is separate.
  hierarchy: (graph, target, options) =>
    arrangeSlice(graph, target, { ...options, axis: resolveAxis('top-down') }),
  flow: (graph, target, options) =>
    arrangeSlice(graph, target, { ...options, axis: resolveAxis('left-right') }),
};

/** Resolves one named strategy. Every name in the record model has an implementation. */
export function layoutStrategyFor(name: LayoutStrategyName): LayoutStrategy {
  return strategies[name];
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
