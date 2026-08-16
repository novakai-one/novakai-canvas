import type { RoomDesign } from '../../designs/room-design';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

/**
 * Read-only stage state supplied to every Stage sheet design.
 *
 * Stage designs only ever own the sheet projection — the world projection renders
 * through the host's own branch, above this seam.
 */
export type StageDesignData = {
  readonly graph: ObjectGraph;
  readonly stage: ObjectRecord;
  readonly conditionLine: string;
  readonly tasks: readonly ObjectRecord[];
  readonly childStages: readonly ObjectRecord[];
  readonly blockers: readonly ObjectRecord[];
  readonly selected: ObjectRecord | null;
  readonly attentionSubjectId: ObjectId | null;
};

/** Host-owned operations available to every Stage sheet design. */
export type StageDesignCommands = {
  select(record: ObjectRecord | null): void;
  enterChildStage(stage: ObjectRecord): void;
};

/** The complete host contract for a Stage sheet design. */
export type StageDesignProps = {
  data: StageDesignData;
  commands: StageDesignCommands;
};

/** A disposable Stage sheet design registered through the generic Room seam. */
export type StageDesign = RoomDesign<StageDesignProps>;
