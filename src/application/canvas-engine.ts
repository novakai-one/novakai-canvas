import { applyCanvasCommand } from '../domain/commands';
import type { ArchitectureDocument, CanvasCommand } from '../domain/model';
import type { JsonRepository } from './json-repository';

/** Small interface hiding canvas state lifecycle. */
export interface CanvasEngine {
  snapshot(): ArchitectureDocument;
  execute(command: CanvasCommand): void;
  replace(document: ArchitectureDocument): void;
  save(): Promise<void>;
  /** Discards in-memory state in favour of what the repository holds now. */
  reload(): Promise<void>;
  /** Revision last known to match the repository — equal to snapshot().revision when clean. */
  persistedRevision(): number;
  subscribe(listener: () => void): () => void;
}

/** Deep module hiding mutation, revisioning, subscriptions, and persistence. */
export function createCanvasEngine(
  initial: ArchitectureDocument,
  repository: JsonRepository<ArchitectureDocument>,
): CanvasEngine {
  let document = initial;
  let persisted = initial.revision;
  const listeners = new Set<() => void>();
  const publish = (): void => listeners.forEach((listener) => listener());

  return {
    snapshot: () => document,
    execute(command) {
      document = applyCanvasCommand(document, command);
      publish();
    },
    replace(next) {
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
      publish();
    },
    persistedRevision: () => persisted,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
