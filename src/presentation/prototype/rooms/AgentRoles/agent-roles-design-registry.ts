import { createDesignRegistry } from '../../designs/design-registry';
import { currentAgentRolesDesign } from './designs/current';
import type { AgentRolesDesign, AgentRolesDesignProps } from './agent-roles-design';

const agentRolesDesignRegistry = createDesignRegistry<AgentRolesDesignProps>(
  [currentAgentRolesDesign],
  currentAgentRolesDesign.id,
);

/** Resolves the URL design ID with a deliberate fallback to the current role library. */
export function resolveAgentRolesDesign(search: string): AgentRolesDesign {
  const requestedId = new URLSearchParams(search).get('agentRolesDesign');
  return agentRolesDesignRegistry.resolve(requestedId);
}
