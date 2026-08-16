import type { AttentionAction, AttentionItem } from '../../attention/feed';
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
  act(
    item: AttentionItem,
    action: AttentionAction['kind'],
    input?: CommandActionInput,
  ): CommandOutcome;
  canOpen(record: ObjectRecord): boolean;
  open(record: ObjectRecord): void;
};

/** Optional input collected by a design before an attention command executes. */
export type CommandActionInput = {
  readonly response?: string;
  readonly replacement?: string;
  readonly confirmed?: boolean;
};

/** User-facing result of applying an attention command. */
export type CommandOutcome =
  | { readonly state: 'applied'; readonly message: string }
  | { readonly state: 'needs-input'; readonly message: string }
  | { readonly state: 'cancelled'; readonly message: string };

/** Replacement choices presented by designs that ask the user to choose. */
export const REPLACEMENT_AGENTS = ['Rune', 'Vell', 'Orin', 'Perrin'] as const;

/** The complete host contract for a Command Center design. */
export type CommandCenterDesignProps = {
  data: CommandCenterDesignData;
  commands: CommandCenterDesignCommands;
};

/** A disposable Command Center design registered through the generic Room seam. */
export type CommandCenterDesign = RoomDesign<CommandCenterDesignProps>;
