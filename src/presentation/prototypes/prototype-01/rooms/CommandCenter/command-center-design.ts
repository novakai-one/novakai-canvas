import type { AttentionItem } from '../../attention/feed';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';
import type { RoomDesign } from '../../designs/room-design';

/** Read-only Command Center state supplied to every visual design. */
export type CommandCenterDesignData = {
  graph: ObjectGraph;
  feed: readonly AttentionItem[];
  elected: AttentionItem | null;
  selected: ObjectRecord | null;
};

/** Store actions available to a Command Center design. */
export type CommandCenterDesignCommands = {
  select(id: ObjectId | null): void;
  patch(id: ObjectId, fields: Record<string, unknown>): void;
  addRecord(record: ObjectRecord): void;
  canOpen(record: ObjectRecord): boolean;
  open(record: ObjectRecord): void;
};

/** The complete host contract for a Command Center design. */
export type CommandCenterDesignProps = {
  data: CommandCenterDesignData;
  commands: CommandCenterDesignCommands;
};

/** A disposable Command Center design registered through the generic Room seam. */
export type CommandCenterDesign = RoomDesign<CommandCenterDesignProps>;
