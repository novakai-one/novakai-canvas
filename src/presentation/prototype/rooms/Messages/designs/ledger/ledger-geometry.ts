/**
 * Semantic geometry for the correspondence ledger: state is geometry, not badges.
 *
 * Every number a band's shape carries means something — the gap above it is elapsed
 * time, its spine tick is message volume. Pure functions only; the DOM measures real
 * heights and these estimates just keep first paint close to truth.
 */

/** World-space skeleton of the ledger. Bands sit at x=0; the spine runs to their left. */
export const BAND_WIDTH = 1080;
export const GUTTER_WIDTH = 84;
export const TURN_WIDTH = 640;
export const MARGIN_WIDTH = 356;
export const SPINE_X = -84;

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function logScale(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const clamped = Math.min(Math.max(value, fromMin), fromMax);
  const t = Math.log(clamped / fromMin) / Math.log(fromMax / fromMin);
  return Math.round(toMin + t * (toMax - toMin));
}

/** Gap above an exchange: a burst reads dense, a stall reads as silence. */
export function exchangeGapPx(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 12;
  return logScale(elapsedMs, MINUTE, DAY, 12, 96);
}

/** Gap above a band: conversations drift apart as time passes between them. */
export function bandGapPx(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 64;
  return logScale(elapsedMs, 10 * MINUTE, 7 * DAY, 64, 240);
}

/** Spine tick length grows with the conversation's message volume. */
export function tickLengthPx(messageCount: number): number {
  return Math.min(28, Math.max(8, 8 + messageCount * 2.5));
}

/** A silence long enough to deserve its own rule in the ledger. */
export function timeRuleLabel(elapsedMs: number): string | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 4 * HOUR) return null;
  if (elapsedMs >= DAY) return `${Math.round(elapsedMs / DAY)} d of silence`;
  return `${Math.round(elapsedMs / HOUR)} h of silence`;
}

/** First-paint height guess; the measured DOM height replaces it immediately. */
export function estimateBandHeight(turnCount: number, ghost: boolean): number {
  return ghost ? 400 : 170 + turnCount * 135;
}
