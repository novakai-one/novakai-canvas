import type { RoomDesign } from '../../designs/room-design';
import type { ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

/** Read-only Room state supplied to any Messages design. */
export type MessagesDesignData = {
  graph: ObjectGraph;
  threads: readonly ObjectRecord[];
  liveAgents: readonly ObjectRecord[];
  selected: ObjectRecord | null;
  attentionSubjectId: string | null;
  initialThreadId?: string;
};

/** Host actions available to any Messages design. */
export type MessagesDesignCommands = {
  select(record: ObjectRecord | null): void;
  canOpen(record: ObjectRecord): boolean;
  open(record: ObjectRecord): void;
  send(threadId: string, body: string): void;
  startConversation(agent: ObjectRecord): string;
};

/** The entire Messages contract a disposable design may depend on. */
export type MessagesDesignProps = {
  data: MessagesDesignData;
  commands: MessagesDesignCommands;
};

/** A disposable Messages Room design registered through the generic Room seam. */
export type MessagesDesign = RoomDesign<MessagesDesignProps>;
