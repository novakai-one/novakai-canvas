import type { MissionWorldDesign } from '../../mission-world-design';
import { CurrentMissionWorld } from './CurrentMissionWorld';

/** The spatial execution chassis retained as the default Mission World design. */
export const currentMissionWorldDesign = {
  id: 'current',
  label: 'Current Mission World',
  View: CurrentMissionWorld,
} satisfies MissionWorldDesign;
