import type { WorldViewport } from './world-camera';

type CanvasPosition = {
  x: number;
  y: number;
};

type PositionedCanvasNode = {
  id: string;
  position: CanvasPosition;
};

const CANVAS_MEMORY_STORAGE_KEY = 'novakai:world-canvas:v1';

type StoredCanvasMemory = {
  viewports: Record<string, WorldViewport>;
  positions: Record<string, Record<string, CanvasPosition>>;
};

const rememberedViewports = new Map<string, WorldViewport>();
const rememberedNodePositions = new Map<string, Map<string, CanvasPosition>>();
let hasLoadedBrowserMemory = false;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCanvasPosition(value: unknown): value is CanvasPosition {
  if (!value || typeof value !== 'object') return false;
  const position = value as Partial<CanvasPosition>;
  return isFiniteNumber(position.x) && isFiniteNumber(position.y);
}

function isWorldViewport(value: unknown): value is WorldViewport {
  if (!isCanvasPosition(value)) return false;
  return isFiniteNumber((value as Partial<WorldViewport>).zoom);
}

function loadBrowserMemory(): void {
  if (hasLoadedBrowserMemory || typeof window === 'undefined') return;
  hasLoadedBrowserMemory = true;

  const stored = window.localStorage.getItem(CANVAS_MEMORY_STORAGE_KEY);
  if (!stored) return;

  try {
    const parsed = JSON.parse(stored) as Partial<StoredCanvasMemory>;
    for (const [key, viewport] of Object.entries(parsed.viewports ?? {})) {
      if (isWorldViewport(viewport)) rememberedViewports.set(key, { ...viewport });
    }
    for (const [key, positions] of Object.entries(parsed.positions ?? {})) {
      const validPositions = Object.entries(positions).filter((entry) => isCanvasPosition(entry[1]));
      rememberedNodePositions.set(
        key,
        new Map(validPositions.map(([id, position]) => [id, { ...position }])),
      );
    }
  } catch {
    window.localStorage.removeItem(CANVAS_MEMORY_STORAGE_KEY);
  }
}

function storeBrowserMemory(): void {
  if (typeof window === 'undefined') return;

  const viewports = Object.fromEntries(
    [...rememberedViewports].map(([key, viewport]) => [key, { ...viewport }]),
  );
  const positions = Object.fromEntries(
    [...rememberedNodePositions].map(([key, values]) => [
      key,
      Object.fromEntries([...values].map(([id, position]) => [id, { ...position }])),
    ]),
  );
  window.localStorage.setItem(
    CANVAS_MEMORY_STORAGE_KEY,
    JSON.stringify({ viewports, positions } satisfies StoredCanvasMemory),
  );
}

/** Reads a defensive copy of the viewport remembered for a Room design. */
export function readRememberedViewport(memoryKey: string): WorldViewport | undefined {
  loadBrowserMemory();
  const viewport = rememberedViewports.get(memoryKey);
  return viewport ? { ...viewport } : undefined;
}

/** Remembers the latest settled viewport for a Room design. */
export function rememberViewport(memoryKey: string, viewport: WorldViewport): void {
  loadBrowserMemory();
  rememberedViewports.set(memoryKey, { ...viewport });
  storeBrowserMemory();
}

/** Applies remembered positions without mutating design-owned node records. */
export function restoreNodePositions<NodeType extends PositionedCanvasNode>(
  memoryKey: string,
  nodes: readonly NodeType[],
): NodeType[] {
  loadBrowserMemory();
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
  loadBrowserMemory();
  const positions = rememberedNodePositions.get(memoryKey) ?? new Map();
  positions.set(nodeId, { ...position });
  rememberedNodePositions.set(memoryKey, positions);
  storeBrowserMemory();
}
