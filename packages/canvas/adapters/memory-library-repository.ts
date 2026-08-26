import type { CanvasLibraryRepository, WriteOutcome } from '../contract/ports/library-repository.ts';
import type { DiagramRecord } from '../contract/records/diagram.ts';
import type { LibraryIndex } from '../contract/records/library.ts';

/** Controls used by tests to prove behaviour that production storage only exhibits rarely. */
export interface MemoryRepositoryControls {
  /** Diagram IDs whose reads throw, proving one record loads while its neighbours cannot. */
  failReadsFor?: Set<string>;
  /** Diagram IDs whose writes fail, proving save failures surface instead of vanishing. */
  failWritesFor?: Set<string>;
}

/**
 * A repository held entirely in memory.
 *
 * Exists so the whole capability can be driven with no server, no disk, and no browser — and
 * so failures that real storage produces only under a race can be produced on demand.
 */
export function createMemoryLibraryRepository(
  seed: { index: LibraryIndex; records: Record<string, DiagramRecord> },
  controls: MemoryRepositoryControls = {},
): CanvasLibraryRepository {
  let index = structuredClone(seed.index);
  const records = new Map(Object.entries(structuredClone(seed.records)));

  return {
    async readIndex() {
      return structuredClone(index);
    },
    async writeIndex(next, expectedRevision): Promise<WriteOutcome> {
      if (index.revision !== expectedRevision) {
        return { status: 'stale-revision', actualRevision: index.revision };
      }
      index = structuredClone(next);
      return { status: 'written', revision: index.revision };
    },
    async readDiagram(id) {
      if (controls.failReadsFor?.has(id)) throw new Error(`unreadable-record:${id}`);
      const record = records.get(id);
      if (!record) throw new Error(`diagram-not-found:${id}`);
      return structuredClone(record);
    },
    async writeDiagram(record, expectedRevision): Promise<WriteOutcome> {
      if (controls.failWritesFor?.has(record.id)) {
        return { status: 'save-failed', reason: `unwritable-record:${record.id}` };
      }
      const stored = records.get(record.id);
      if (stored && stored.revision !== expectedRevision) {
        return { status: 'stale-revision', actualRevision: stored.revision };
      }
      records.set(record.id, structuredClone(record));
      return { status: 'written', revision: record.revision };
    },
    async deleteDiagram(id) {
      records.delete(id);
    },
    async listDiagramIds() {
      return [...records.keys()].sort();
    },
  };
}
