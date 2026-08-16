/**
 * The field's geometry: elapsed time becomes drop-distance, scale and fade.
 *
 * Nothing decorative lives here. Every number maps one fact onto one spatial lever:
 * silence pushes a plaque further down its rail, shrinks it, and lets it recede into
 * the dark — atmospheric perspective as recency.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Elapsed-time anchors and the drop (px below the rail head) each one earns. */
const DROP_ANCHORS: readonly (readonly [number, number])[] = [
  [0, 0],
  [5 * MINUTE, 14],
  [HOUR, 92],
  [6 * HOUR, 190],
  [DAY, 280],
  [3 * DAY, 360],
  [7 * DAY, 420],
];

export const MAX_DROP_PX = 440;

/** Log-interpolated drop: a quiet hour costs visibly more height than a quiet minute. */
export function dropPx(elapsedMs: number): number {
  const last = DROP_ANCHORS[DROP_ANCHORS.length - 1];
  if (elapsedMs >= last[0]) return Math.min(MAX_DROP_PX, last[1] + 8);
  for (let index = 1; index < DROP_ANCHORS.length; index += 1) {
    const [ms, drop] = DROP_ANCHORS[index];
    if (elapsedMs > ms) continue;
    const [previousMs, previousDrop] = DROP_ANCHORS[index - 1];
    const span = ms - previousMs || 1;
    const progress = (elapsedMs - previousMs) / span;
    return previousDrop + progress * (drop - previousDrop);
  }
  return 0;
}

/** Newest reads full-size; a week of silence shrinks a plaque to 78%. */
export function plaqueScale(elapsedMs: number): number {
  return 1 - 0.22 * (dropPx(elapsedMs) / MAX_DROP_PX);
}

/** Contrast falls with age; the floor of 0.5 keeps every conversation findable. */
export function plaqueFade(elapsedMs: number): number {
  return 1 - 0.5 * (dropPx(elapsedMs) / MAX_DROP_PX);
}

/** The horizontal time rules drawn across the field, labelled at the left margin. */
export const TIME_TICKS: readonly { label: string; dropPx: number }[] = [
  { label: 'now', dropPx: 0 },
  { label: '1h', dropPx: dropPx(HOUR) },
  { label: '6h', dropPx: dropPx(6 * HOUR) },
  { label: '1d', dropPx: dropPx(DAY) },
  { label: '3d', dropPx: dropPx(3 * DAY) },
];

/** Compact "how long ago" label shown on each plaque. */
export function elapsedLabel(elapsedMs: number): string {
  if (elapsedMs < MINUTE) return 'now';
  if (elapsedMs < HOUR) return `${Math.round(elapsedMs / MINUTE)}m`;
  if (elapsedMs < DAY) return `${Math.round(elapsedMs / HOUR)}h`;
  return `${Math.round(elapsedMs / DAY)}d`;
}

/** Rails share the width evenly but never crowd below a readable line. */
export function railSpacingPx(railCount: number, fieldWidthPx: number): number {
  if (railCount === 0) return fieldWidthPx;
  return Math.max(190, Math.floor(fieldWidthPx / railCount));
}

/** Plaques on one rail keep their time-drop unless they would overlap; then they yield. */
export function stackedDrops(drops: readonly number[], plaqueHeightPx: number): number[] {
  let floor = -Infinity;
  return drops.map((ideal) => {
    const resolved = Math.max(ideal, floor);
    floor = resolved + plaqueHeightPx;
    return resolved;
  });
}
