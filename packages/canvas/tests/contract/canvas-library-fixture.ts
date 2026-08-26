import { parseArchitectureDocument } from '@novakai/canvas';
import { migrateDocumentToLibrary } from '@novakai/canvas';
import { createMemoryLibraryRepository } from '@novakai/canvas';
import {
  createCanvasLibrary,
  type CanvasLibrary,
  type CanvasLibraryRepository,
  type WriteOutcome,
} from '@novakai/canvas';
import type { ActorContext, CanvasWorkspace } from '@novakai/canvas';
import working from '../fixtures/migration/real-v2-working-copy.json' with { type: 'json' };

export const human: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui' },
};

export function openLibrary(controls?: { failReadsFor?: Set<string>; failWritesFor?: Set<string> }): {
  library: CanvasLibrary;
} {
  const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  const repository = createMemoryLibraryRepository(migrated, controls ?? {});
  return { library: createCanvasLibrary(repository, migrated.index, human) };
}

export async function openWorkspace(library: CanvasLibrary, id: string): Promise<CanvasWorkspace> {
  const opened = await library.open(id);
  if ('status' in opened) throw new Error(`could not open ${id}: ${opened.status}`);
  return opened;
}


export function allDiagramIds(): string[] {
  const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  return Object.keys(migrated.records);
}

/**
 * A library whose index writes can be made to conflict on demand.
 *
 * The race these tests drive — a second host landing an index write between this session's
 * diagram write and its index commit — cannot be interleaved from outside `save`, so the
 * repository wrapper refuses the next `indexConflicts` index writes exactly the way a real
 * compare-and-swap race would. `writes.diagrams` counts record writes so a save can prove it
 * did not rewrite a record that was already on disk.
 */
export function openRacingLibrary(): {
  library: CanvasLibrary;
  repository: CanvasLibraryRepository;
  race: { indexConflicts: number };
  writes: { diagrams: number };
} {
  const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  const inner = createMemoryLibraryRepository(migrated, {});
  const race = { indexConflicts: 0 };
  const writes = { diagrams: 0 };
  const repository: CanvasLibraryRepository = {
    ...inner,
    writeDiagram(record, expectedRevision) {
      writes.diagrams += 1;
      return inner.writeDiagram(record, expectedRevision);
    },
    writeIndex(index, expectedRevision) {
      if (race.indexConflicts > 0) {
        race.indexConflicts -= 1;
        return Promise.resolve<WriteOutcome>({
          status: 'stale-revision', actualRevision: expectedRevision + 1,
        });
      }
      return inner.writeIndex(index, expectedRevision);
    },
  };
  return {
    library: createCanvasLibrary(repository, migrated.index, human),
    repository: inner,
    race,
    writes,
  };
}

export {
  createCanvasLibrary,
  createMemoryLibraryRepository,
  migrateDocumentToLibrary,
  parseArchitectureDocument,
  working,
};
