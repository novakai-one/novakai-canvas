import { makeRecord, sessionId } from '../../app/store';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import { EFFORT_OPTIONS } from './agent-roles-design';

type RoleCreationEffects = {
  addRecord(record: ObjectRecord): void;
  select(id: ObjectId | null): void;
};

/** Creates a draft role with its full default policy set, selects it, and returns its id. */
export function createRole(effects: RoleCreationEffects): ObjectId {
  const roleId = sessionId('role', 'new role');

  effects.addRecord(makeRecord(roleId, 'agentRoleProfile', 'New role', {
    name: 'New role',
    description: 'Say what this role owns, and where its authority stops.',
    status: 'draft',
    permissionLevel: 'read-only',
    effortPolicy: { allowed: [...EFFORT_OPTIONS], defaultEffort: 'medium' },
    modelPolicy: { defaultModelId: 'claude-sonnet-5' },
    providerPolicy: { defaultProvider: 'anthropic' },
    __envelope: { id: roleId, kind: 'agentRoleProfile', schemaVersion: 2, permissionLevel: 'read-only' },
  }));

  effects.select(roleId);
  return roleId;
}
