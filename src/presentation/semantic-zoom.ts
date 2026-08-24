/** Semantic detail levels derived from the live optical zoom. */
export type SemanticZoomTier = 'overview' | 'readable' | 'detail';

/** Published centre points; hysteresis keeps a tier stable near either boundary. */
export const SEMANTIC_ZOOM_THRESHOLDS = {
  overview: 0.32,
  detail: 0.68,
  hysteresis: 0.04,
} as const;

/**
 * Resolve one live zoom to one semantic tier.
 *
 * The previous tier is optional for first paint and required during continuous zoom. A small
 * dead-band around each threshold prevents DOM visibility flicker when a trackpad oscillates on
 * the boundary. Invalid values preserve the previous tier, or choose detail so content is never
 * accidentally hidden on an uninitialised camera.
 */
export function semanticZoomTier(
  zoom: number,
  previous?: SemanticZoomTier,
): SemanticZoomTier {
  if (!Number.isFinite(zoom) || zoom <= 0) return previous ?? 'detail';
  const { overview, detail, hysteresis } = SEMANTIC_ZOOM_THRESHOLDS;
  if (!previous) return zoom < overview ? 'overview' : zoom < detail ? 'readable' : 'detail';

  if (previous === 'overview') {
    if (zoom < overview + hysteresis) return 'overview';
    return zoom >= detail + hysteresis ? 'detail' : 'readable';
  }
  if (previous === 'detail') {
    if (zoom >= detail - hysteresis) return 'detail';
    return zoom < overview - hysteresis ? 'overview' : 'readable';
  }
  if (zoom < overview - hysteresis) return 'overview';
  if (zoom >= detail + hysteresis) return 'detail';
  return 'readable';
}
