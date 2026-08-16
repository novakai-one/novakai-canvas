import { createDesignRegistry } from '../../designs/design-registry';
import { currentHomeDesign } from './designs/current';
import type { HomeDesign, HomeDesignProps } from './home-design';

const homeDesignRegistry = createDesignRegistry<HomeDesignProps>(
  [currentHomeDesign],
  currentHomeDesign.id,
);

/** Lists every design available to the Home selector. */
export function listHomeDesigns(): readonly HomeDesign[] {
  return homeDesignRegistry.list();
}

/** Resolves the URL design ID with a deliberate fallback to the current Home. */
export function resolveHomeDesign(search: string): HomeDesign {
  const requestedId = new URLSearchParams(search).get('homeDesign');
  return homeDesignRegistry.resolve(requestedId);
}
