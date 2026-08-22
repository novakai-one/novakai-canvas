import type { DiagramRecord } from '../domain/records.ts';
import { executeRecordCommand } from './canvas-workspace/command.ts';
import type {
  ActorContext, CanvasWorkspace, ChangeOutcome, RecordChangeSet, RecordCommand,
} from './canvas-workspace/contract.ts';

export type {
  ActorContext, CanvasWorkspace, ChangeOutcome, RecordChangeSet, RecordCommand,
} from './canvas-workspace/contract.ts';
export { isSignatureName } from '../domain/interface-signature.ts';

type PreflightFailure = Exclude<ChangeOutcome, { status: 'applied' }>;
type BatchExecution =
  | { applied: true; record: DiagramRecord }
  | { applied: false; reason: string; commandIndex: number };

class WorkspaceRuntime implements CanvasWorkspace {
  private record: DiagramRecord;
  private readonly context: ActorContext;
  private readonly historyLimit: number;
  private readonly history: DiagramRecord[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(initial: DiagramRecord, context: ActorContext, historyLimit: number) {
    this.record = initial;
    this.context = context;
    this.historyLimit = historyLimit;
  }

  snapshot(): DiagramRecord {
    return this.record;
  }

  submit(changeSet: RecordChangeSet): ChangeOutcome {
    const failure = this.preflight(changeSet);
    if (failure) return failure;
    const execution = this.applyCommands(changeSet.commands);
    if (!execution.applied) {
      return { status: 'rejected', reason: execution.reason, commandIndex: execution.commandIndex };
    }
    return this.commit(execution.record, changeSet);
  }

  execute(command: RecordCommand): ChangeOutcome {
    return this.submit({
      operationId: `${this.context.provenance.source}-${globalThis.crypto.randomUUID()}`,
      expectedRevision: this.record.revision,
      timestamp: new Date().toISOString(),
      commands: [command],
    });
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;
    this.record = {
      ...previous,
      revision: this.record.revision + 1,
      appliedOperations: this.record.appliedOperations,
    };
    this.publish();
    return true;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private preflight(changeSet: RecordChangeSet): PreflightFailure | undefined {
    const alreadyApplied = this.record.appliedOperations[changeSet.operationId];
    if (alreadyApplied) {
      return {
        status: 'duplicate',
        originalRevision: alreadyApplied.revision,
        revision: this.record.revision,
      };
    }
    if (changeSet.expectedRevision !== this.record.revision) {
      return {
        status: 'conflict',
        expectedRevision: changeSet.expectedRevision,
        actualRevision: this.record.revision,
      };
    }
    if (changeSet.commands.length === 0) return { status: 'rejected', reason: 'empty-change-set' };
    return undefined;
  }

  private applyCommands(commands: RecordCommand[]): BatchExecution {
    let candidate = this.record;
    for (let index = 0; index < commands.length; index += 1) {
      const execution = executeRecordCommand(candidate, commands[index]);
      if (!execution.applied) return { ...execution, commandIndex: index };
      candidate = execution.record;
    }
    return { applied: true, record: candidate };
  }

  private commit(candidate: DiagramRecord, changeSet: RecordChangeSet): ChangeOutcome {
    const revision = this.record.revision + 1;
    this.remember(this.record);
    this.record = {
      ...candidate,
      revision,
      appliedOperations: {
        ...candidate.appliedOperations,
        [changeSet.operationId]: {
          operationId: changeSet.operationId,
          revision,
          actor: structuredClone(this.context.actor),
          timestamp: changeSet.timestamp,
          provenance: structuredClone(this.context.provenance),
          commandKinds: changeSet.commands.map((command) => command.kind),
        },
      },
    };
    this.publish();
    return { status: 'applied', revision, commandsApplied: changeSet.commands.length };
  }

  private remember(state: DiagramRecord): void {
    this.history.push(state);
    if (this.history.length > this.historyLimit) this.history.shift();
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

/** Opens one diagram record as a mutable, revisioned workspace. */
export function createCanvasWorkspace(
  initial: DiagramRecord,
  context: ActorContext,
  options: { historyLimit?: number } = {},
): CanvasWorkspace {
  return new WorkspaceRuntime(initial, context, options.historyLimit ?? 50);
}
