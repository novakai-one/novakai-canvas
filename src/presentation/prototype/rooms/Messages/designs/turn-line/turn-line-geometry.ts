/**
 * Wait becomes distance; distance becomes depth.
 *
 * One quantity drives the whole plane. A conversation's wait sets how far out from the
 * seam it sits, how far back into the field it recedes, how large it is drawn and how
 * much fog it collects. Exchange volume sets how tall the block stands. Everything a
 * reader can measure by eye here is a fact about the conversation; nothing is spacing
 * chosen to look pleasant. Pure geometry — no React, no DOM, no graph.
 */
import type { TurnHolder, TurnLineThread } from './turn-line-model';

/** The three named distances the legend spells out. */
export type DepthTier = 'now' | 'hours' | 'days';

export type FieldSize = { readonly width: number; readonly height: number };

export type PlacedThread = {
  readonly thread: TurnLineThread;
  readonly side: TurnHolder;
  /** Centre of the block, in field pixels. */
  readonly x: number;
  /** Baseline the block stands on, in field pixels. */
  readonly y: number;
  readonly tier: DepthTier;
  readonly width: number;
  readonly scale: number;
  /** How much of the field's fog this block has collected, 0 near to 1 far. */
  readonly haze: number;
  /** Height of the extruded side face in pixels — depth of exchange made solid. */
  readonly extrusion: number;
};

export type RulerTick = {
  readonly label: string;
  /** Distance from the seam in field pixels. */
  readonly offset: number;
};

export type FieldLayout = {
  readonly seamX: number;
  readonly placed: readonly PlacedThread[];
  /** Conversations pushed past the back edge, per side. Never silently dropped. */
  readonly overflow: Readonly<Record<TurnHolder, readonly TurnLineThread[]>>;
  readonly ticks: readonly RulerTick[];
  readonly planeTop: number;
  readonly planeBottom: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MARGIN_X = 24;
const SEAM_CLEARANCE = 88;
const PLANE_TOP = 104;
const PLANE_BOTTOM_INSET = 92;
const ROW_STEP = 42;
const GAP_X = 14;
const MAX_ROW_SEARCH = 14;
const WIDEST_HALF = 88;

const TIER_WIDTH: Record<DepthTier, number> = { now: 176, hours: 140, days: 96 };
const TIER_SCALE: Record<DepthTier, number> = { now: 1, hours: 0.86, days: 0.72 };

/** Wait compressed onto 0..1. Logarithmic, because minutes and days share one field. */
function logFraction(waitMs: number, maxWaitMs: number): number {
  if (maxWaitMs <= 0) return 0;
  const compress = (value: number) => Math.log1p(value / MINUTE);
  return Math.min(1, compress(waitMs) / compress(maxWaitMs));
}

/**
 * Where a wait sits among the waits that actually exist, 0..1.
 *
 * Real agent work clumps: nine conversations can all be "yesterday". A purely
 * logarithmic axis stacks that clump into one column and leaves the rest of the plane
 * empty, so the axis also carries the shape of the data. Both terms rise with wait, so
 * a longer wait is always further out and the ruler still lands where it claims.
 */
function densityFraction(waitMs: number, sortedWaits: readonly number[]): number {
  const count = sortedWaits.length;
  if (count < 2) return 0;
  let below = 0;
  while (below < count && sortedWaits[below] < waitMs) below += 1;
  let at = below;
  while (at < count && sortedWaits[at] === waitMs) at += 1;
  // Ties share the midpoint of the range they occupy, so equals land together.
  const rank = at > below ? (below + at - 1) / 2 : below;
  return Math.min(1, rank / (count - 1));
}

const DENSITY_WEIGHT = 0.55;

function positionFraction(
  waitMs: number,
  maxWaitMs: number,
  sortedWaits: readonly number[],
): number {
  return (
    (1 - DENSITY_WEIGHT) * logFraction(waitMs, maxWaitMs) +
    DENSITY_WEIGHT * densityFraction(waitMs, sortedWaits)
  );
}

export function tierOf(waitMs: number): DepthTier {
  if (waitMs < HOUR) return 'now';
  if (waitMs < DAY) return 'hours';
  return 'days';
}

/**
 * Deeper exchanges stand taller.
 *
 * Capped below the block's own height: an offset taller than the face it belongs to
 * separates from it and stops reading as one solid.
 */
function extrusionOf(exchange: number, ghost: boolean): number {
  if (ghost) return 0;
  return 5 + Math.min(exchange, 8) * 2;
}

const TICK_STOPS: readonly (readonly [number, string])[] = [
  [0, 'now'],
  [HOUR, '1h'],
  [6 * HOUR, '6h'],
  [DAY, '1d'],
  [7 * DAY, '1w'],
  [28 * DAY, '4w'],
];

/**
 * Places every conversation, then reports what did not fit.
 *
 * Nearest waits are placed first so the freshest work owns the front of the plane.
 * A block that would land on top of an already-placed neighbour is pushed one row
 * further back — which keeps the reading "further back is older or more crowded"
 * true — and a block pushed past the horizon is handed to the overflow cluster
 * rather than being drawn off the edge.
 */
export function layoutField(
  threads: readonly TurnLineThread[],
  maxWaitMs: number,
  size: FieldSize,
): FieldLayout {
  const seamX = Math.round(size.width / 2);
  const planeTop = PLANE_TOP;
  const planeBottom = Math.max(planeTop + ROW_STEP, size.height - PLANE_BOTTOM_INSET);
  const reach = Math.max(120, seamX - MARGIN_X - SEAM_CLEARANCE / 2 - WIDEST_HALF);
  const sortedWaits = threads.map((thread) => thread.waitMs).sort((a, b) => a - b);

  const placed: PlacedThread[] = [];
  const overflow: Record<TurnHolder, TurnLineThread[]> = { you: [], them: [] };
  const takenBySide: Record<TurnHolder, PlacedThread[]> = { you: [], them: [] };

  for (const thread of threads) {
    const fraction = positionFraction(thread.waitMs, maxWaitMs, sortedWaits);
    const tier = tierOf(thread.waitMs);
    const width = TIER_WIDTH[tier];
    const direction = thread.holder === 'you' ? -1 : 1;
    const x = seamX + direction * (SEAM_CLEARANCE / 2 + fraction * reach);
    const baseline = planeBottom - fraction * (planeBottom - planeTop);

    const neighbours = takenBySide[thread.holder];
    const collides = (candidate: number) =>
      neighbours.some(
        (other) =>
          Math.abs(other.y - candidate) < ROW_STEP - 6 &&
          Math.abs(other.x - x) < (other.width + width) / 2 + GAP_X,
      );

    // Conversations of the same age are interchangeable in depth, so a crowded row
    // opens outwards in both directions rather than marching off the horizon.
    let y = Number.NaN;
    for (let step = 0; step <= MAX_ROW_SEARCH; step += 1) {
      const candidates = step === 0 ? [baseline] : [baseline + step * ROW_STEP, baseline - step * ROW_STEP];
      const free = candidates.find(
        (candidate) => candidate > planeTop && candidate < planeBottom + ROW_STEP && !collides(candidate),
      );
      if (free !== undefined) {
        y = free;
        break;
      }
    }

    if (Number.isNaN(y)) {
      overflow[thread.holder].push(thread);
      continue;
    }

    const entry: PlacedThread = {
      thread,
      side: thread.holder,
      x,
      y,
      tier,
      width,
      scale: TIER_SCALE[tier],
      haze: fraction,
      extrusion: extrusionOf(thread.exchange, thread.ghost),
    };
    placed.push(entry);
    neighbours.push(entry);
  }

  const ticks = TICK_STOPS.filter(([waitMs]) => waitMs <= maxWaitMs).map(([waitMs, label]) => ({
    label,
    offset: SEAM_CLEARANCE / 2 + positionFraction(waitMs, maxWaitMs, sortedWaits) * reach,
  }));

  return { seamX, placed, overflow, ticks, planeTop, planeBottom };
}
