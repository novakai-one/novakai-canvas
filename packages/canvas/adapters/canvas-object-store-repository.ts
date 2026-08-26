import type { JsonRepository } from '../contract/ports/json-repository.ts';
import type {
  CanvasDocumentRecord, CanvasObjectStore,
} from '../contract/ports/object-store.ts';
import type { ArchitectureDocument } from '../contract/records/legacy.ts';
import { architectureDocumentSchema } from '../contract/schemas.ts';

function parseRecord(input: unknown, expectedId: string): CanvasDocumentRecord {
  if (!input || typeof input !== 'object') throw new Error('invalid-canvas-document-record');
  const candidate = input as Partial<CanvasDocumentRecord>;
  if (candidate.kind !== 'canvas.document' || candidate.id !== expectedId) {
    throw new Error('invalid-canvas-document-record');
  }
  const value = architectureDocumentSchema.parse(candidate.value);
  if (candidate.revision !== value.revision) throw new Error('canvas-record-revision-mismatch');
  return { kind: 'canvas.document', id: expectedId, revision: value.revision, value };
}

/** Adapts Canvas to a typed CAS object store without exposing storage mechanics to core. */
export function createCanvasObjectStoreRepository(
  store: CanvasObjectStore,
  documentId: string,
  fallback: ArchitectureDocument,
): JsonRepository<ArchitectureDocument> {
  const key = `canvas.document:${documentId}`;
  let knownRevision: number | undefined;
  return {
    async load() {
      const stored = await store.read(key);
      if (stored === undefined) {
        knownRevision = undefined;
        return architectureDocumentSchema.parse(fallback);
      }
      const record = parseRecord(stored, documentId);
      knownRevision = record.revision;
      return record.value;
    },
    async save(value) {
      const document = architectureDocumentSchema.parse(value);
      const saved = await store.compareAndSet(key, knownRevision, {
        kind: 'canvas.document', id: documentId, revision: document.revision, value: document,
      });
      if (!saved) throw new Error('stale-revision');
      knownRevision = document.revision;
    },
  };
}
