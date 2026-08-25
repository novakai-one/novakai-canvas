/** The dagre call: ranking siblings, and sizing the container that has to hold them. */

import dagre from '@dagrejs/dagre';
import type { Position } from '../spatial.ts';
import type { NodePlacement } from '../records.ts';
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
