import { createDesignRegistry } from '../../designs/design-registry';
import type {
  CommandCenterDesign,
  CommandCenterDesignProps,
} from './command-center-design';
import { currentCommandCenterDesign } from './designs/current';

const commandCenterDesignRegistry = createDesignRegistry<CommandCenterDesignProps>(
  [currentCommandCenterDesign],
  currentCommandCenterDesign.id,
);

/** Lists every design available to the Command Center selector. */
export function listCommandCenterDesigns(): readonly CommandCenterDesign[] {
  return commandCenterDesignRegistry.list();
}

/** Resolves the URL design ID with a deliberate fallback to the current design. */
export function resolveCommandCenterDesign(search: string): CommandCenterDesign {
  const requestedId = new URLSearchParams(search).get('commandDesign');
  return commandCenterDesignRegistry.resolve(requestedId);
}
