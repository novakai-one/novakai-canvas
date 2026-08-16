export type AtlasZoomTier = 'overview' | 'working' | 'detail';

/** Keeps labels from flickering when a gesture hovers near a zoom boundary. */
export function resolveZoomTier(zoom: number, current: AtlasZoomTier): AtlasZoomTier {
  if (current === 'overview') return zoom >= 0.6 ? 'working' : 'overview';
  if (current === 'detail') return zoom <= 1.02 ? 'working' : 'detail';
  if (zoom <= 0.5) return 'overview';
  if (zoom >= 1.18) return 'detail';
  return 'working';
}
