import { createDesignRegistry } from '../../designs/design-registry';
import { currentMissionsDesign } from './designs/current';
import type { MissionsDesign, MissionsDesignProps } from './missions-design';

const missionsDesignRegistry = createDesignRegistry<MissionsDesignProps>(
  [currentMissionsDesign],
  currentMissionsDesign.id,
);

/** Lists every design available to the Mission List selector. */
export function listMissionsDesigns(): readonly MissionsDesign[] {
  return missionsDesignRegistry.list();
}

/** Resolves the URL design ID with a deliberate fallback to the current Mission List. */
export function resolveMissionsDesign(search: string): MissionsDesign {
  const requestedId = new URLSearchParams(search).get('missionsDesign');
  return missionsDesignRegistry.resolve(requestedId);
}
