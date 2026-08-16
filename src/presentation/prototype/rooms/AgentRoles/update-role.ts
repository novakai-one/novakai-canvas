import type { ObjectId } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';
import type { RoleSaveInput } from './agent-roles-design';

type RoleUpdateEffects = {
  readonly graph: ObjectGraph;
  patch(id: ObjectId, fields: Record<string, unknown>): void;
};

/**
 * The authoritative role save.
 *
 * Permission merges into `__envelope` and effort into `effortPolicy` here, on top of
 * the role's current fields — designs pass plain values and can never half-write the
 * envelope.
 */
export function updateRole(input: RoleSaveInput, effects: RoleUpdateEffects): void {
  const role = effects.graph.get(input.roleId);
  if (!role) return;

  effects.patch(input.roleId, {
    title: input.name,
    name: input.name,
    description: input.description,
    permissionLevel: input.permissionLevel,
    effortPolicy: {
      ...(role.fields.effortPolicy as object),
      defaultEffort: input.defaultEffort,
    },
    __envelope: {
      ...(role.fields.__envelope as object),
      permissionLevel: input.permissionLevel,
    },
  });
}
