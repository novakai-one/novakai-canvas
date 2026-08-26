import type { DiagramRecord, LibraryIndex } from '../records/index.ts';

/** Result of writing one record, including the concurrency outcome the host must handle. */
export type WriteOutcome =
  | { status: 'written'; revision: number }
  | { status: 'stale-revision'; actualRevision: number }
  | { status: 'save-failed'; reason: string };

/** Durable storage for independently addressed, revisioned diagram records. */
export interface CanvasLibraryRepository {
  readIndex(): Promise<LibraryIndex>;
  writeIndex(index: LibraryIndex, expectedRevision: number): Promise<WriteOutcome>;
  readDiagram(id: string): Promise<DiagramRecord>;
  writeDiagram(record: DiagramRecord, expectedRevision: number): Promise<WriteOutcome>;
  deleteDiagram(id: string): Promise<void>;
  listDiagramIds(): Promise<string[]>;
}
