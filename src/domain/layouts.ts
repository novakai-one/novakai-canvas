import type {
  ArchitectureDocument, CanvasLayout, CanvasNode, NodePlacement, PositionedCanvasNode,
} from './legacy-document.ts';

const FALLBACK_PLACEMENT: Omit<NodePlacement, 'nodeId'> = {
  position: { x: 0, y: 0 },
  size: { width: 1, height: 1 },
  pinned: false,
};

/** Resolves a saved layout, defaulting to the document's active layout. */
export function resolveLayout(document: ArchitectureDocument, layoutId?: string): CanvasLayout {
  const resolvedId = layoutId ?? document.activeLayoutId;
  const layout = document.layouts[resolvedId];
  if (!layout) throw new Error(`unknown-layout:${resolvedId}`);
  return layout;
}

/** Reads one placement without leaking a mutable layout record to callers. */
export function placementFor(
  document: ArchitectureDocument,
  nodeId: string,
  layoutId?: string,
): NodePlacement {
  return resolveLayout(document, layoutId).placements[nodeId]
    ?? { nodeId, ...structuredClone(FALLBACK_PLACEMENT) };
}

/** Joins semantic nodes with one saved layout for layout and rendering adapters. */
export function positionedNodes(
  document: ArchitectureDocument,
  layoutId?: string,
): Record<string, PositionedCanvasNode> {
  return Object.fromEntries(Object.entries(document.nodes).map(([id, node]) => [id, {
    ...node,
    ...placementFor(document, id, layoutId),
  }])) as Record<string, PositionedCanvasNode>;
}

/** Replaces one placement in one layout while preserving semantic node data. */
export function replacePlacement(
  document: ArchitectureDocument,
  placement: NodePlacement,
  layoutId?: string,
): ArchitectureDocument {
  const layout = resolveLayout(document, layoutId);
  return {
    ...document,
    layouts: {
      ...document.layouts,
      [layout.id]: {
        ...layout,
        placements: { ...layout.placements, [placement.nodeId]: placement },
      },
    },
  };
}

/** Adds geometry for a new semantic node to one layout. */
export function addNodePlacement(
  document: ArchitectureDocument,
  node: CanvasNode,
  placement: NodePlacement,
  layoutId?: string,
): ArchitectureDocument {
  if (node.id !== placement.nodeId) throw new Error('node-placement-id-mismatch');
  return replacePlacement(document, placement, layoutId);
}

/** Removes one node's geometry from every saved layout. */
export function removeNodePlacements(
  document: ArchitectureDocument,
  nodeId: string,
): ArchitectureDocument {
  return {
    ...document,
    layouts: Object.fromEntries(Object.entries(document.layouts).map(([layoutId, layout]) => {
      const placements = { ...layout.placements };
      delete placements[nodeId];
      return [layoutId, { ...layout, placements }];
    })),
  };
}
