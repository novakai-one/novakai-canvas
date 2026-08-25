/** Deterministic per-wire label placement, so labels sharing a path separate instead of stacking. */

export interface WireLabelSpread {
  /** Along-path offset from the wire midpoint, as a route fraction. */
  along: number;
  /** Which side of the wire the label rides on. */
  side: 1 | -1;
}

/** djb2 over the wire id; stable across sessions because ids persist in the record. */
function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Slots either side of the midpoint; far enough apart that two neighbouring labels clear each other. */
const ALONG_SLOTS = [-0.09, -0.045, 0, 0.045, 0.09] as const;

/**
 * Coincident wires would otherwise stack every label at the same midpoint. The spread derives
 * from the wire id, never from render order, so a label sits in the same place after every reload.
 */
export function wireLabelSpread(seed: string): WireLabelSpread {
  const hash = hashString(seed);
  return {
    along: ALONG_SLOTS[hash % ALONG_SLOTS.length],
    side: Math.floor(hash / ALONG_SLOTS.length) % 2 === 0 ? 1 : -1,
  };
}
