/** The dagre call: ranking siblings, and sizing the container that has to hold them. */

import dagre from '@dagrejs/dagre';
import type { Position } from '../../../contract/types/spatial.ts';
import type { NodePlacement } from '../../../contract/records/index.ts';
import type { LayoutGraph, LayoutOptions } from './contract.ts';

const MIN_GROUP_SIZE = { width: 320, height: 160 };

/**
 * Ranks the given siblings with dagre and returns positions relative to the block's top-left.
 *
 * The caller decides where that block lands, which is what keeps a slice from teleporting to the
 * origin of its container.
 */
export function rankedPositions(
  graph: LayoutGraph,
  ids: string[],
  working: Map<string, NodePlacement>,
  options: LayoutOptions,
  rollup?: ReadonlyMap<string, string>,
): Map<string, Position> {
  const ranked = new dagre.graphlib.Graph();
  ranked.setGraph({
    rankdir: options.axis.rankDirection, nodesep: options.nodeGap, ranksep: options.rankGap,
  });
  ranked.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) {
    const { size } = working.get(id) as NodePlacement;
    ranked.setNode(id, { width: size.width, height: size.height });
  }

  // With a rollup, a wire between two siblings' descendants ranks those siblings against
  // each other, so groups are arranged by the wires their members send and receive.
  const within = new Set(ids);
  const endpointOf = (nodeId: string): string | undefined => {
    const rolled = rollup?.get(nodeId) ?? nodeId;
    return within.has(rolled) ? rolled : undefined;
  };
  for (const wireId of Object.keys(graph.wires).sort()) {
    const wire = graph.wires[wireId];
    const source = endpointOf(wire.source.nodeId as string);
    const target = endpointOf(wire.target.nodeId as string);
    if (source !== undefined && target !== undefined && source !== target) {
      ranked.setEdge(source, target);
    }
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

export function sizeContaining(
  childIds: string[],
  working: Map<string, NodePlacement>,
  options: LayoutOptions,
) {
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
