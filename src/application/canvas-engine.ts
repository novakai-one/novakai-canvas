import { applyCanvasCommandBatch, CanvasCommandError } from '../domain/commands.ts';
import type {
  ArchitectureDocument, CanvasCapabilityDescription, CanvasChangeOutcome, CanvasChangeSet, CanvasCommand, CanvasImportSet,
  NodeKind, WireKind,
} from '../domain/model';
import type { JsonRepository } from './json-repository';
import { kindList } from '../components/registry.ts';

/** The legacy document calls the container kind `scope`; records (and the registry) call it `group`. */
const LEGACY_KIND_NAMES: Record<string, NodeKind> = { group: 'scope' };

/** Small interface hiding canvas state lifecycle. */
export interface CanvasEngine {
  snapshot(): ArchitectureDocument;
  execute(command: CanvasCommand): CanvasChangeOutcome;
  submit(changeSet: CanvasChangeSet): CanvasChangeOutcome;
  importDocument(importSet: CanvasImportSet): CanvasChangeOutcome;
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
    nodeKinds: kindList().map((kind) => LEGACY_KIND_NAMES[kind] ?? (kind as NodeKind)),
    nodeAliases: { group: 'scope' },
    wireKinds: ['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing'] satisfies WireKind[],
    layoutTargets: ['diagram', 'group', 'nodes'],
    layoutStrategies: ['manual', 'hierarchy'],
    commandKinds: [
      'diagram.create', 'diagram.setStatus', 'diagram.setReferences',
      'node.add', 'node.move', 'node.resize', 'node.pin', 'node.update', 'node.setSubject',
      'node.setDetailDiagram', 'node.reparent',
      'node.setCollapsed', 'node.remove',
      'wire.add', 'wire.update', 'wire.reconnect', 'wire.remove',
      'layout.apply', 'scope.layout', 'document.import',
    ],
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
  const importDocument = (importSet: CanvasImportSet): CanvasChangeOutcome => {
    const applied = document.appliedOperations[importSet.operationId];
    if (applied) {
      return {
        status: 'duplicate', operationId: importSet.operationId,
        originalRevision: applied.revision, revision: document.revision,
      };
    }
    if (importSet.expectedRevision !== document.revision) {
      return {
        status: 'conflict', operationId: importSet.operationId,
        expectedRevision: importSet.expectedRevision, actualRevision: document.revision,
      };
    }
    if (importSet.document.id !== document.id) {
      return { status: 'rejected', operationId: importSet.operationId, reason: 'document-id-mismatch' };
    }
    const revision = document.revision + 1;
    const candidate: ArchitectureDocument = {
      ...structuredClone(importSet.document),
      revision,
      appliedOperations: {
        ...document.appliedOperations,
        ...importSet.document.appliedOperations,
        [importSet.operationId]: {
          operationId: importSet.operationId,
          revision,
          actor: structuredClone(importSet.actor),
          timestamp: importSet.timestamp,
          provenance: structuredClone(importSet.provenance),
          commandKinds: ['document.import'],
        },
      },
    };
    history.push(document);
    if (history.length > 100) history.shift();
    document = candidate;
    publish();
    return { status: 'applied', operationId: importSet.operationId, revision, commandsApplied: 1 };
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
    importDocument,
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
