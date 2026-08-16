/** Zoom tiers for the causal field, with hysteresis so the look never flickers. */
export type FieldTier = 'far' | 'working' | 'near';

const FAR_ENTER = 0.4;
const FAR_EXIT = 0.5;
const NEAR_ENTER = 1.14;
const NEAR_EXIT = 1.04;

export function resolveFieldTier(zoom: number, previous: FieldTier): FieldTier {
  if (previous === 'far') return zoom >= FAR_EXIT ? 'working' : 'far';
  if (previous === 'near') return zoom <= NEAR_EXIT ? 'working' : 'near';
  if (zoom <= FAR_ENTER) return 'far';
  if (zoom >= NEAR_ENTER) return 'near';
  return 'working';
}
