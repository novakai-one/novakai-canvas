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

  return {
    snapshot: () => document,
    execute(command) {
      history.push(document);
      if (history.length > 100) history.shift();
      document = applyCanvasCommand(document, command);
      publish();
    },
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
      document = { ...previous, revision: document.revision + 1 };
      publish();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
