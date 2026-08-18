import type { CanvasNodePlacement, WorldPoint } from '../../../../../components/canvas/WorldCanvas';
import type { BenchInspectionTrail, BenchState } from './bench-model';

/** Fixed card geometry required by the Bench contract. */
export const BENCH_CARD_SIZE = { width: 320, height: 128 } as const;

/** Fixed open-thread geometry required by the Bench contract. */
export const BENCH_THREAD_SIZE = { width: 420, height: 640 } as const;

/** Fixed inspection-node geometry used by rightward trail layout. */
export const BENCH_INSPECTOR_SIZE = { width: 280, height: 320 } as const;

/** Framework-neutral placement consumed by Bench layout. */
export type BenchPlacement = CanvasNodePlacement;

/** Placement lookup used by projection without owning persistence. */
export type BenchPlacementMap = ReadonlyMap<string, BenchPlacement>;

/** Result of placing one inspection trail. */
export type BenchTrailLayout = ReadonlyMap<string, WorldPoint>;

const DEFAULT_CONVERSATION_POINTS: readonly WorldPoint[] = [
  { x: 80, y: 72 },
  { x: 456, y: 104 },
  { x: 832, y: 56 },
  { x: 160, y: 312 },
  { x: 552, y: 352 },
  { x: 936, y: 296 },
  { x: 304, y: 560 },
  { x: 760, y: 584 },
];

const INSPECTION_GAP_X = 88;
const INSPECTION_STEP_X = BENCH_INSPECTOR_SIZE.width + 72;
const INSPECTION_STEP_Y = 48;

/** Snaps a world point to the configured drag grid. */
export function snapBenchPoint(point: WorldPoint, step = 8): WorldPoint {
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  };
}

/** Converts a placement snapshot into a read-only lookup. */
export function placementMapOf(placements: readonly BenchPlacement[]): BenchPlacementMap {
  return new Map(placements.map((placement) => [placement.id, placement]));
}

/** Returns a restored conversation position or its deliberate first-visit point. */
export function conversationPoint(
  nodeId: string,
  conversationIndex: number,
  placements: BenchPlacementMap,
): WorldPoint {
  const restored = placements.get(nodeId);
  if (restored) return { ...restored.position };
  const point = DEFAULT_CONVERSATION_POINTS[conversationIndex % DEFAULT_CONVERSATION_POINTS.length];
  const row = Math.floor(conversationIndex / DEFAULT_CONVERSATION_POINTS.length);
  return { x: point.x + row * 64, y: point.y + row * 760 };
}

function trailDepth(trail: BenchInspectionTrail, stepId: string): number {
  const byId = new Map(trail.steps.map((step) => [step.id, step]));
  let depth = 0;
  let current = byId.get(stepId);
  while (current?.parentStepId) {
    depth += 1;
    current = byId.get(current.parentStepId);
  }
  return depth;
}

/** Places an inspection trail to the right of its restored conversation parent. */
export function layoutInspectionTrail(
  trail: BenchInspectionTrail,
  state: BenchState,
  conversationPosition: WorldPoint,
  trailIndex: number,
): BenchTrailLayout {
  const conversationWidth = state.session.openThreadIds.includes(trail.threadId)
    ? BENCH_THREAD_SIZE.width
    : BENCH_CARD_SIZE.width;
  const relationX = conversationPosition.x + conversationWidth + INSPECTION_GAP_X;
  const relationY = conversationPosition.y + 64 + trailIndex * INSPECTION_STEP_Y;
  const positions = trail.steps.map((step) => {
    const depth = trailDepth(trail, step.id);
    return [step.id, { x: relationX + depth * INSPECTION_STEP_X, y: relationY }] as const;
  });
  return new Map(positions);
}

/** Finds an unoccupied point for later pane-created nodes. */
export function firstFreePoint(
  requested: WorldPoint,
  occupied: readonly WorldPoint[],
): WorldPoint {
  let candidate = snapBenchPoint(requested);
  const conflicts = (point: WorldPoint) => occupied.some((other) => (
    Math.abs(other.x - point.x) < BENCH_CARD_SIZE.width
    && Math.abs(other.y - point.y) < BENCH_CARD_SIZE.height
  ));
  while (conflicts(candidate)) {
    candidate = { x: candidate.x + 40, y: candidate.y + 40 };
  }
  return candidate;
}

/** Returns the frame position produced by dropping one conversation near another. */
export function frameDropPoint(first: WorldPoint, second: WorldPoint): WorldPoint {
  return snapBenchPoint({
    x: Math.min(first.x, second.x) - 24,
    y: Math.min(first.y, second.y) - 40,
  });
}
