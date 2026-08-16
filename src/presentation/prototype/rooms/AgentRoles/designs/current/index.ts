import type { AgentRolesDesign } from '../../agent-roles-design';
import { CurrentAgentRoles } from './CurrentAgentRoles';

export const currentAgentRolesDesign = {
  id: 'current',
  label: 'Current Role Library',
  View: CurrentAgentRoles,
} satisfies AgentRolesDesign;
