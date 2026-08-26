/** Node-only composition used by the CLI and development file bridge. */
export {
  bootstrapLibrary,
  type BootstrapOutcome,
} from '../../adapters/node/legacy-library-bootstrap.ts';

import { bootstrapLibrary } from '../../adapters/node/legacy-library-bootstrap.ts';
import {
  createDirectoryLibraryRepository as createDirectoryAdapter,
  dataDirectoryOf,
} from '../../adapters/stores/directory.ts';
import { createCanvasLibrary } from '../../core/application/canvas-library.ts';
import { diagramRecordSchema } from '../../core/domain/record-schema.ts';
import type { CanvasLibrary } from '../library.ts';
import type { CanvasLibraryRepository } from '../ports/library-repository.ts';
import type { DiagramRecord } from '../records/index.ts';
import { libraryIndexSchema } from '../schemas/library.ts';

export { dataDirectoryOf };

/** Composes the Node directory adapter with the shared validated record boundary. */
export function createDirectoryLibraryRepository(dataDir: string): CanvasLibraryRepository {
  return createDirectoryAdapter(dataDir, {
    diagram: diagramRecordSchema,
    library: libraryIndexSchema,
  });
}

/** An opened library and repository composed for Node-based callers. */
export interface OpenedLibrary {
  repository: CanvasLibraryRepository;
  library: CanvasLibrary;
  dataDir: string;
}

/** Opens the directory-backed library after the existing one-time migration. */
export async function openLibrary(dataDir: string, sourceRef: string): Promise<OpenedLibrary> {
  await bootstrapLibrary(dataDir);
  const repository = createDirectoryLibraryRepository(dataDir);
  const index = await repository.readIndex();
  const library = createCanvasLibrary(repository, index, {
    actor: { id: 'canvas-cli', kind: 'system' },
    provenance: { source: 'cli', sourceRef },
  });
  return { repository, library, dataDir };
}

/** Reads every indexed diagram record for whole-library authoring operations. */
export async function readAllRecords(
  repository: CanvasLibraryRepository,
  library: CanvasLibrary,
): Promise<Record<string, DiagramRecord>> {
  const summaries = library.list({ includeArchived: true });
  const records = await Promise.all(summaries.map((summary) => repository.readDiagram(summary.id)));
  return Object.fromEntries(records.map((record) => [record.id, record]));
}
