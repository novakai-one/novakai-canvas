/** Public state, outcome and lifecycle contract for one opened Canvas diagram. */

import type { CanvasActor, CanvasProvenance } from '../../domain/legacy-operation.ts';
import type { DiagramRecord } from '../../domain/records.ts';
import type { RecordCommand } from './commands.ts';

export type { RecordCommand } from './commands.ts';

/** Who is acting and through which surface. Supplied by the host, never by a caller payload. */
export interface ActorContext {
  actor: CanvasActor;
  provenance: CanvasProvenance;
}

/** A batch of intentions applied as one revision, or not at all. */
export interface RecordChangeSet {
  operationId: string;
  expectedRevision: number;
  timestamp: string;
  commands: RecordCommand[];
}

/** What happened to a submitted batch. Every failure is named, none are exceptions. */
export type ChangeOutcome =
  | { status: 'applied'; revision: number; commandsApplied: number }
  | { status: 'duplicate'; originalRevision: number; revision: number }
  | { status: 'conflict'; expectedRevision: number; actualRevision: number }
  | { status: 'rejected'; reason: string; commandIndex?: number };

/** One opened diagram's authority over its own content, revision and history. */
export interface CanvasWorkspace {
  snapshot(): DiagramRecord;
  submit(changeSet: RecordChangeSet): ChangeOutcome;
  /** Convenience for host interactions; wraps one command in a fully attributed batch. */
  execute(command: RecordCommand): ChangeOutcome;
  canUndo(): boolean;
  undo(): boolean;
  subscribe(listener: () => void): () => void;
}
