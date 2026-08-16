import { createDesignRegistry } from '../../designs/design-registry';
import { currentStageSheetDesign } from './designs/current';
import type { StageDesign, StageDesignProps } from './stage-design';

const stageDesignRegistry = createDesignRegistry<StageDesignProps>(
  [currentStageSheetDesign],
  currentStageSheetDesign.id,
);

/** Resolves the URL design ID with a deliberate fallback to the current Stage sheet. */
export function resolveStageDesign(search: string): StageDesign {
  const requestedId = new URLSearchParams(search).get('stageDesign');
  return stageDesignRegistry.resolve(requestedId);
}
