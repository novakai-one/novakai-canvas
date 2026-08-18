import type { Node } from '@xyflow/react';

/** A framework-neutral point in the canvas world. */
export type WorldPoint = { readonly x: number; readonly y: number };

/** Grid steps applied by the shared canvas while a node is dragged. */
export type CanvasDragGrid = { readonly xStep: number; readonly yStep: number };

/** One settled node placement emitted without exposing a React Flow node. */
export type CanvasNodePlacement = {
  readonly id: string;
  readonly position: WorldPoint;
  readonly parentId?: string;
};

/** A complete placement snapshot after restore or one settled drag. */
export type CanvasPlacementChange = {
  readonly cause: 'restore' | 'drag-end';
  readonly movedNodeId: string | null;
  readonly placements: readonly CanvasNodePlacement[];
};

/** Copies framework nodes into the neutral placement contract. */
export function placementsFromNodes<NodeType extends Node>(
  nodes: readonly NodeType[],
): CanvasNodePlacement[] {
  return nodes.map((node) => ({
    id: node.id,
    position: { x: node.position.x, y: node.position.y },
    ...(node.parentId ? { parentId: node.parentId } : {}),
  }));
}
