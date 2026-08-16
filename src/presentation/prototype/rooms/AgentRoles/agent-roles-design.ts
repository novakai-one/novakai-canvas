import type { RoomDesign } from '../../designs/room-design';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

/** The effort levels a role may default to. Part of the contract so host and designs agree. */
export const EFFORT_OPTIONS = ['low', 'medium', 'high'] as const;

/** The permission envelopes a role may carry. */
export const PERMISSION_OPTIONS = [
  'read-only',
  'restricted',
  'workspace-write',
  'orchestrate',
  'vault',
] as const;

/**
 * Everything a design may change about a role in one save. The target is always
 * `roleId` — never inferred from current selection.
 */
export type RoleSaveInput = {
  readonly roleId: ObjectId;
  readonly name: string;
  readonly description: string;
  readonly permissionLevel: string;
  readonly defaultEffort: string;
};

/** Read-only role library state supplied to every Agent Roles design. */
export type AgentRolesDesignData = {
  readonly graph: ObjectGraph;
  readonly roles: readonly ObjectRecord[];
  readonly selected: ObjectRecord | null;
  readonly attentionSubjectId: ObjectId | null;
};

/** Host-owned operations available to every Agent Roles design. */
export type AgentRolesDesignCommands = {
  select(record: ObjectRecord | null): void;
  openAgent(agent: ObjectRecord): void;
  /** Creates a draft role and returns its id so the design can open its editor. */
  createRole(): ObjectId;
  saveRole(input: RoleSaveInput): void;
};

/** The complete host contract for an Agent Roles design. */
export type AgentRolesDesignProps = {
  data: AgentRolesDesignData;
  commands: AgentRolesDesignCommands;
};

/** A disposable Agent Roles design registered through the generic Room seam. */
export type AgentRolesDesign = RoomDesign<AgentRolesDesignProps>;
