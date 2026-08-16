import type { WorldViewport } from './world-camera';

type CanvasPosition = {
  x: number;
  y: number;
};

type PositionedCanvasNode = {
  id: string;
  position: CanvasPosition;
};

const rememberedViewports = new Map<string, WorldViewport>();
const rememberedNodePositions = new Map<string, Map<string, CanvasPosition>>();

/** Reads a defensive copy of the viewport remembered for a Room design. */
export function readRememberedViewport(memoryKey: string): WorldViewport | undefined {
  const viewport = rememberedViewports.get(memoryKey);
  return viewport ? { ...viewport } : undefined;
}

/** Remembers the latest settled viewport for a Room design. */
export function rememberViewport(memoryKey: string, viewport: WorldViewport): void {
  rememberedViewports.set(memoryKey, { ...viewport });
}

/** Applies remembered positions without mutating design-owned node records. */
export function restoreNodePositions<NodeType extends PositionedCanvasNode>(
  memoryKey: string,
  nodes: readonly NodeType[],
): NodeType[] {
  const positions = rememberedNodePositions.get(memoryKey);
  if (!positions) return [...nodes];

  return nodes.map((node) => {
    const rememberedPosition = positions.get(node.id);
    return rememberedPosition
      ? { ...node, position: { ...rememberedPosition } }
      : node;
  });
}

/** Remembers one settled node position without retaining a mutable React Flow object. */
export function rememberNodePosition(
  memoryKey: string,
  nodeId: string,
  position: CanvasPosition,
): void {
  const positions = rememberedNodePositions.get(memoryKey) ?? new Map();
  positions.set(nodeId, { ...position });
  rememberedNodePositions.set(memoryKey, positions);
}
