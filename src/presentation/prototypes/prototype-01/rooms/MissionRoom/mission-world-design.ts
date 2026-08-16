import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';
import type { RoomDesign } from '../../designs/room-design';

/** Read-only execution state supplied to every Mission World design. */
export type MissionWorldDesignData = {
  graph: ObjectGraph;
  subject: ObjectRecord;
  roots?: readonly ObjectRecord[];
  selected: ObjectRecord | null;
  revealedStageIds: readonly string[];
  attentionSubjectId: string | null;
};

/** Host actions available to every Mission World design. */
export type MissionWorldDesignCommands = {
  select(id: ObjectId | null): void;
  toggleReveal(stageId: string): void;
  openStage(stageId: string): void;
  canOpen(record: ObjectRecord): boolean;
  open(record: ObjectRecord): void;
};

/** The complete host contract for a Mission World design. */
export type MissionWorldDesignProps = {
  data: MissionWorldDesignData;
  commands: MissionWorldDesignCommands;
};

/** A disposable Mission World design registered through the generic Room seam. */
export type MissionWorldDesign = RoomDesign<MissionWorldDesignProps>;
