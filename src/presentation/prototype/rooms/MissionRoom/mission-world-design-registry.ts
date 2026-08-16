import { createDesignRegistry } from '../../designs/design-registry';
import type {
  MissionWorldDesign,
  MissionWorldDesignProps,
} from './mission-world-design';
import { currentMissionWorldDesign } from './designs/current';

const missionWorldDesignRegistry = createDesignRegistry<MissionWorldDesignProps>(
  [currentMissionWorldDesign],
  currentMissionWorldDesign.id,
);

/** Lists every design available to the Mission World selector. */
export function listMissionWorldDesigns(): readonly MissionWorldDesign[] {
  return missionWorldDesignRegistry.list();
}

/** Resolves the URL design ID with a deliberate fallback to the current Mission World. */
export function resolveMissionWorldDesign(search: string): MissionWorldDesign {
  const requestedId = new URLSearchParams(search).get('missionDesign');
  return missionWorldDesignRegistry.resolve(requestedId);
}
