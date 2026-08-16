import type { RoomDesign } from '../../designs/room-design';
import type { AreaKey } from '../../app/store';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

/** One rail destination, pre-described by the host: label, line, count, attention. */
export type HomeDestination = {
  readonly key: AreaKey;
  readonly label: string;
  readonly line: string;
  readonly count: string;
  readonly needsAttention: boolean;
};

/**
 * One pinned object with its subject already resolved. `canOpen` carries the host's
 * navigation policy — the app's Room object never crosses this seam.
 */
export type HomePin = {
  readonly pin: ObjectRecord;
  readonly subject: ObjectRecord;
  readonly canOpen: boolean;
};

/** Read-only orientation state supplied to every Home design. */
export type HomeDesignData = {
  readonly graph: ObjectGraph;
  readonly destinations: readonly HomeDestination[];
  readonly pins: readonly HomePin[];
  readonly selected: ObjectRecord | null;
  readonly attentionSubjectId: ObjectId | null;
};

/** Host-owned operations available to every Home design. */
export type HomeDesignCommands = {
  select(record: ObjectRecord | null): void;
  /** Opens the record's room; a no-op when its pin says `canOpen` is false. */
  open(record: ObjectRecord): void;
  goToArea(key: AreaKey): void;
};

/** The complete host contract for a Home design. */
export type HomeDesignProps = {
  data: HomeDesignData;
  commands: HomeDesignCommands;
};

/** A disposable Home design registered through the generic Room seam. */
export type HomeDesign = RoomDesign<HomeDesignProps>;
