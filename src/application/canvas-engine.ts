import { applyCanvasCommand } from '../domain/commands';
import type { ArchitectureDocument, CanvasCommand } from '../domain/model';
import type { JsonRepository } from './json-repository';

/** Small interface hiding canvas state lifecycle. */
export interface CanvasEngine {
  snapshot(): ArchitectureDocument;
  execute(command: CanvasCommand): void;
  replace(document: ArchitectureDocument): void;
  save(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

/** Deep module hiding mutation, revisioning, subscriptions, and persistence. */
export function createCanvasEngine(
  initial: ArchitectureDocument,
  repository: JsonRepository<ArchitectureDocument>,
): CanvasEngine {
  let document = initial;
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
    save: () => repository.save(document),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
