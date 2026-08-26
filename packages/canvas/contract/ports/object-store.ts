import type { ArchitectureDocument } from '../records/legacy.ts';

/** Typed value stored at the legacy Canvas document key. */
export interface CanvasDocumentRecord {
  kind: 'canvas.document';
  id: string;
  revision: number;
  value: ArchitectureDocument;
}

/** Compare-and-set object storage required by the legacy document adapter. */
export interface CanvasObjectStore {
  read(key: string): Promise<unknown | undefined>;
  compareAndSet(
    key: string,
    expectedRevision: number | undefined,
    record: CanvasDocumentRecord,
  ): Promise<boolean>;
}
