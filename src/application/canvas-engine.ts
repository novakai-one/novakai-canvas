import { applyCanvasCommandBatch, CanvasCommandError } from '../domain/commands.ts';
import type {
  ArchitectureDocument, CanvasCapabilityDescription, CanvasChangeOutcome, CanvasChangeSet, CanvasCommand,
  NodeKind, WireKind,
} from '../domain/model';
import type { JsonRepository } from './json-repository';

/** Small interface hiding canvas state lifecycle. */
export interface CanvasEngine {
  snapshot(): ArchitectureDocument;
  execute(command: CanvasCommand): CanvasChangeOutcome;
  submit(changeSet: CanvasChangeSet): CanvasChangeOutcome;
  describe(): CanvasCapabilityDescription;
  replace(document: ArchitectureDocument): void;
  save(): Promise<void>;
  /** Discards in-memory state in favour of what the repository holds now. */
  reload(): Promise<void>;
  /** Revision last known to match the repository — equal to snapshot().revision when clean. */
  persistedRevision(): number;
  canUndo(): boolean;
  undo(): boolean;
  subscribe(listener: () => void): () => void;
}

/** Deep module hiding mutation, revisioning, subscriptions, and persistence. */
export function createCanvasEngine(
  initial: ArchitectureDocument,
  repository: JsonRepository<ArchitectureDocument>,
): CanvasEngine {
  let document = initial;
  let persisted = initial.revision;
  const history: ArchitectureDocument[] = [];
  const listeners = new Set<() => void>();
  const publish = (): void => listeners.forEach((listener) => listener());
  const describe = (): CanvasCapabilityDescription => ({
    schemaVersion: document.schemaVersion,
    revision: document.revision,
    nodeKinds: ['scope', 'module', 'object', 'runtime', 'resource', 'comment', 'tree'] satisfies NodeKind[],
    nodeAliases: { group: 'scope' },
    wireKinds: ['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing'] satisfies WireKind[],
    layoutTargets: ['diagram', 'group', 'nodes'],
    layoutStrategies: ['manual', 'hierarchy'],
  });
  const submit = (changeSet: CanvasChangeSet): CanvasChangeOutcome => {
    const applied = document.appliedOperations[changeSet.operationId];
    if (applied) {
      return {
        status: 'duplicate', operationId: changeSet.operationId,
        originalRevision: applied.revision, revision: document.revision,
      };
    }
    if (changeSet.expectedRevision !== document.revision) {
      return {
        status: 'conflict', operationId: changeSet.operationId,
        expectedRevision: changeSet.expectedRevision, actualRevision: document.revision,
      };
    }
    if (changeSet.commands.length === 0) {
      return { status: 'rejected', operationId: changeSet.operationId, reason: 'empty-change-set' };
    }
    let candidate: ArchitectureDocument;
    try {
      candidate = applyCanvasCommandBatch(document, changeSet.commands);
    } catch (error) {
      return {
        status: 'rejected', operationId: changeSet.operationId,
        reason: error instanceof Error ? error.message : String(error),
        ...(error instanceof CanvasCommandError ? { commandIndex: error.commandIndex } : {}),
      };
    }
    candidate = {
      ...candidate,
      appliedOperations: {
        ...candidate.appliedOperations,
        [changeSet.operationId]: {
          operationId: changeSet.operationId,
          revision: candidate.revision,
          actor: structuredClone(changeSet.actor),
          timestamp: changeSet.timestamp,
          provenance: structuredClone(changeSet.provenance),
          commandKinds: changeSet.commands.map((command) => command.kind),
        },
      },
    };
    history.push(document);
    if (history.length > 100) history.shift();
    document = candidate;
    publish();
    return {
      status: 'applied', operationId: changeSet.operationId,
      revision: document.revision, commandsApplied: changeSet.commands.length,
    };
  };

  return {
    snapshot: () => document,
    execute(command) {
      return submit({
        operationId: `ui-${globalThis.crypto.randomUUID()}`,
        expectedRevision: document.revision,
        actor: { id: 'local-user', kind: 'human' },
        timestamp: new Date().toISOString(),
        provenance: { source: 'ui' },
        commands: [command],
      });
    },
    submit,
    describe,
    replace(next) {
      history.push(document);
      if (history.length > 100) history.shift();
      document = next;
      publish();
    },
    async save() {
      const snapshot = document;
      await repository.save(snapshot);
      persisted = snapshot.revision;
    },
    async reload() {
      const next = await repository.load();
      document = next;
      persisted = next.revision;
      history.length = 0;
      publish();
    },
    persistedRevision: () => persisted,
    canUndo: () => history.length > 0,
    undo() {
      const previous = history.pop();
      if (!previous) return false;
      document = {
        ...previous,
        revision: document.revision + 1,
        appliedOperations: { ...previous.appliedOperations, ...document.appliedOperations },
      };
      publish();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
