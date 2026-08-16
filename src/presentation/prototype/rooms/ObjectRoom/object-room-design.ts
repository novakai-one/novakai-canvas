import type { RoomDesign } from '../../designs/room-design';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

/** One identity line about the subject, with a hint for how it reads best. */
export type IdentityFact = {
  readonly label: string;
  readonly value: string;
  readonly renderAs: 'text' | 'status' | 'mono';
};

/** A labelled group of records the subject owns or connects to. */
export type ObjectRoomSection = {
  readonly label: string;
  readonly records: readonly ObjectRecord[];
  /** Shown when the section is empty; sections without one simply disappear. */
  readonly emptyMessage?: string;
};

/**
 * Read-only subject state supplied to every Object Room design.
 *
 * The host assembles identity and sections per kind (Project vs Agent), so a design
 * renders them without re-deriving relationships. `openableIds` carries the host's
 * navigation policy: only records in it get an open control.
 */
export type ObjectRoomDesignData = {
  readonly graph: ObjectGraph;
  readonly subject: ObjectRecord;
  readonly identity: readonly IdentityFact[];
  readonly sections: readonly ObjectRoomSection[];
  readonly openableIds: ReadonlySet<ObjectId>;
  readonly selected: ObjectRecord | null;
  readonly attentionSubjectId: ObjectId | null;
};

/** Host-owned operations available to every Object Room design. */
export type ObjectRoomDesignCommands = {
  select(record: ObjectRecord | null): void;
  open(record: ObjectRecord): void;
};

/** The complete host contract for an Object Room design. */
export type ObjectRoomDesignProps = {
  data: ObjectRoomDesignData;
  commands: ObjectRoomDesignCommands;
};

/**
 * A disposable Object Room design registered through the generic Room seam.
 * Every registered design must render BOTH Project and Agent subjects — one
 * `?objectRoomDesign=` value selects the design for both rooms at once.
 */
export type ObjectRoomDesign = RoomDesign<ObjectRoomDesignProps>;
