import type { ComponentType } from 'react';
import type { ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

export type MessagesDesignData = {
  graph: ObjectGraph;
  threads: readonly ObjectRecord[];
  liveAgents: readonly ObjectRecord[];
  selected: ObjectRecord | null;
  initialThreadId?: string;
};

export type MessagesDesignCommands = {
  select(record: ObjectRecord | null): void;
  canOpen(record: ObjectRecord): boolean;
  open(record: ObjectRecord): void;
  send(threadId: string, body: string): void;
  startConversation(agent: ObjectRecord): string;
};

/** The entire contract a disposable Messages design may depend on. */
export type MessagesDesignProps = {
  data: MessagesDesignData;
  commands: MessagesDesignCommands;
};

export type MessagesDesign = {
  id: string;
  label: string;
  View: ComponentType<MessagesDesignProps>;
};
