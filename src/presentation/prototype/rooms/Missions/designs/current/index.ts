import type { MissionsDesign } from '../../missions-design';
import { CurrentMissions } from './CurrentMissions';

export const currentMissionsDesign = {
  id: 'current',
  label: 'Current Mission List',
  View: CurrentMissions,
} satisfies MissionsDesign;
