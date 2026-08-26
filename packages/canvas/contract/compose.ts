/** Browser and embedded persistence compositions supported by Canvas today. */
import { createFileLibraryRepository as createHttpLibraryAdapter } from '../adapters/file-library-repository.ts';
import { diagramRecordSchema } from '../core/domain/record-schema.ts';
import { libraryIndexSchema } from './schemas/library.ts';

/** Composes the HTTP adapter with the same validated record boundary as every other host. */
export function createFileLibraryRepository(base = '/api') {
  return createHttpLibraryAdapter(base, {
    diagram: diagramRecordSchema,
    library: libraryIndexSchema,
  });
}

export { createMemoryLibraryRepository } from '../adapters/memory-library-repository.ts';
export {
  createCanvasObjectStoreRepository,
} from '../adapters/canvas-object-store-repository.ts';
export type { CanvasDocumentRecord, CanvasObjectStore } from './ports/object-store.ts';
