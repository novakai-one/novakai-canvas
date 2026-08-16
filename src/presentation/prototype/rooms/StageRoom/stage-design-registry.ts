import { createDesignRegistry } from '../../designs/design-registry';
import { currentStageSheetDesign } from './designs/current';
import type { StageDesign, StageDesignProps } from './stage-design';

const stageDesignRegistry = createDesignRegistry<StageDesignProps>(
  [currentStageSheetDesign],
  currentStageSheetDesign.id,
);

/** Lists every design available to the Stage sheet selector. */
export function listStageDesigns(): readonly StageDesign[] {
  return stageDesignRegistry.list();
}

/** Resolves the URL design ID with a deliberate fallback to the current Stage sheet. */
export function resolveStageDesign(search: string): StageDesign {
  const requestedId = new URLSearchParams(search).get('stageDesign');
  return stageDesignRegistry.resolve(requestedId);
}
