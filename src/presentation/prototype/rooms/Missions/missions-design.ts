import type { RoomDesign } from '../../designs/room-design';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

/** User input accepted by the host when a Mission List design creates a mission. */
export type MissionCreationInput = {
  readonly title: string;
  readonly notes: string;
  readonly projectId: ObjectId;
  readonly templateId?: ObjectId;
};

/** Read-only mission library state supplied to every Mission List design. */
export type MissionsDesignData = {
  readonly graph: ObjectGraph;
  readonly missions: readonly ObjectRecord[];
  readonly projects: readonly ObjectRecord[];
  readonly templates: readonly ObjectRecord[];
  readonly selected: ObjectRecord | null;
  readonly attentionSubjectId: ObjectId | null;
};

/** Host-owned operations available to every Mission List design. */
export type MissionsDesignCommands = {
  select(mission: ObjectRecord | null): void;
  open(mission: ObjectRecord): void;
  create(input: MissionCreationInput): ObjectId;
};

/** The complete host contract for a Mission List design. */
export type MissionsDesignProps = {
  data: MissionsDesignData;
  commands: MissionsDesignCommands;
};

/** A disposable Mission List design registered through the generic Room seam. */
export type MissionsDesign = RoomDesign<MissionsDesignProps>;
