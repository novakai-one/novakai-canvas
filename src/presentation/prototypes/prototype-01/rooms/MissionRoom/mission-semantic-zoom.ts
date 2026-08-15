export type MissionZoomTier = 'overview' | 'working' | 'detail';

const OVERVIEW_ENTER = 0.43;
const OVERVIEW_EXIT = 0.52;
const DETAIL_ENTER = 1.12;
const DETAIL_EXIT = 1.02;

export function resolveMissionZoomTier(
  zoom: number,
  previous: MissionZoomTier,
): MissionZoomTier {
  if (previous === 'overview') return zoom >= OVERVIEW_EXIT ? 'working' : 'overview';
  if (previous === 'detail') return zoom <= DETAIL_EXIT ? 'working' : 'detail';
  if (zoom <= OVERVIEW_ENTER) return 'overview';
  if (zoom >= DETAIL_ENTER) return 'detail';
  return 'working';
}

export const TIER_RANK: Record<MissionZoomTier, number> = {
  overview: 0,
  working: 1,
  detail: 2,
};

export function stageBoundsForTier(tier: MissionZoomTier) {
  switch (tier) {
    case 'overview':
      return { width: 176, height: 64 };
    case 'detail':
      return { width: 458, height: 178 };
    default:
      return { width: 382, height: 132 };
  }
}

export function atLeastWorking(tier: MissionZoomTier): MissionZoomTier {
  return TIER_RANK[tier] < TIER_RANK.working ? 'working' : tier;
}
