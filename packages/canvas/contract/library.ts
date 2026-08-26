import type { CrossDiagramLink, LibraryEntry, LibraryIndex } from './records/index.ts';
import type { LibraryFailure } from './errors.ts';
import type { WriteOutcome } from './ports/library-repository.ts';
import type { CanvasWorkspace } from './workspace.ts';

/** Diagram identity as the library presents it without opening the record. */
export type DiagramSummary = LibraryEntry;

/** Collection authority for identity, discovery, lifecycle, and cross-record integrity. */
export interface CanvasLibrary {
  list(options?: { includeArchived?: boolean }): DiagramSummary[];
  search(query: string, options?: { includeArchived?: boolean }): DiagramSummary[];
  open(id: string): Promise<CanvasWorkspace | LibraryFailure>;
  create(name: string, id?: string): Promise<DiagramSummary | LibraryFailure>;
  setStatus(id: string, status: 'active' | 'archived'): Promise<DiagramSummary | LibraryFailure>;
  remove(id: string, options?: { force?: boolean }): Promise<true | LibraryFailure>;
  inboundLinks(id: string): string[];
  addLink(link: CrossDiagramLink): Promise<CrossDiagramLink | LibraryFailure>;
  removeLink(id: string): Promise<true | LibraryFailure>;
  rebuildIndex(): Promise<LibraryIndex>;
  save(id: string): Promise<WriteOutcome>;
  index(): LibraryIndex;
}
