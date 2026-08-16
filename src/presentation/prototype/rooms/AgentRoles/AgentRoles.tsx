/**
 * The role blueprint library.
 *
 * A Role is a class, not an instance — the seam keeps that authority with the host:
 * creation and the envelope/effort merge live here, designs only present.
 */
import { useStore } from '../../app/store';
import { createRole } from './create-role';
import { updateRole } from './update-role';
import type { AgentRolesDesignCommands, AgentRolesDesignData } from './agent-roles-design';
import { resolveAgentRolesDesign } from './agent-roles-design-registry';

/** Composition root that supplies app state and host commands to an Agent Roles design. */
export function AgentRoles() {
  const { graph, selected, elected, select, addRecord, patch, enterRoom } = useStore();
  const design = resolveAgentRolesDesign(typeof window === 'undefined' ? '' : window.location.search);
  const DesignView = design.View;

  const data: AgentRolesDesignData = {
    graph,
    roles: graph.byKind('agentRoleProfile'),
    selected,
    attentionSubjectId: elected?.subject.id ?? null,
  };

  const commands: AgentRolesDesignCommands = {
    select: (record) => select(record?.id ?? null),
    openAgent: (agent) => enterRoom({ kind: 'agent', subjectId: agent.id }),
    createRole: () => createRole({ addRecord, select }),
    saveRole: (input) => updateRole(input, { graph, patch }),
  };

  return <DesignView data={data} commands={commands} />;
}
