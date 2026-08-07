import type {
  CrossDiagramLink, DiagramRecord, LibraryEntry, LibraryIndex,
} from '../domain/records.ts';
import { createCanvasWorkspace, type ActorContext, type CanvasWorkspace } from './canvas-workspace.ts';

/** Result of writing one record, including the concurrency outcome the host must handle. */
export type WriteOutcome =
  | { status: 'written'; revision: number }
  | { status: 'stale-revision'; actualRevision: number }
  | { status: 'save-failed'; reason: string };

/**
 * Durable storage for a diagram library.
 *
 * Records are addressed individually so reading one diagram never requires another to be
 * readable, and writes carry the revision they expect: without that check, the CLI and the
 * browser silently overwrite each other.
 */
export interface CanvasLibraryRepository {
  readIndex(): Promise<LibraryIndex>;
  /**
   * Writes the index, refusing a write made against a stale revision.
   *
   * Without this, two hosts saving two different diagrams last-writer-wins the index and one of
   * them loses an entry or a cross-diagram link. The index is a projection over authoritative
   * facts, so a write torn between a record and the index is repaired by rebuilding it.
   */
  writeIndex(index: LibraryIndex, expectedRevision: number): Promise<WriteOutcome>;
  readDiagram(id: string): Promise<DiagramRecord>;
  writeDiagram(record: DiagramRecord, expectedRevision: number): Promise<WriteOutcome>;
  deleteDiagram(id: string): Promise<void>;
  /** Every diagram ID the store holds, so a damaged index can be rebuilt from the records. */
  listDiagramIds(): Promise<string[]>;
}

/** Why a library operation could not be completed. */
export type LibraryFailure =
  | { status: 'diagram-not-found'; id: string }
  | { status: 'diagram-already-exists'; id: string }
  | { status: 'inbound-links-exist'; links: string[] }
  | { status: 'link-not-found'; id: string }
  | { status: 'index-conflict'; actualRevision: number };

/** Diagram identity as the library presents it, without opening the record. */
export type DiagramSummary = LibraryEntry;

/** The collection authority: identity, discovery, lifecycle, and cross-record integrity. */
export interface CanvasLibrary {
  list(options?: { includeArchived?: boolean }): DiagramSummary[];
  /** Case-insensitive substring over diagram name and node labels; ordered by name, then ID. */
  search(query: string, options?: { includeArchived?: boolean }): DiagramSummary[];
  open(id: string): Promise<CanvasWorkspace | LibraryFailure>;
  create(name: string, id?: string): Promise<DiagramSummary | LibraryFailure>;
  setStatus(id: string, status: 'active' | 'archived'): Promise<DiagramSummary | LibraryFailure>;
  remove(id: string, options?: { force?: boolean }): Promise<true | LibraryFailure>;
  /** Diagrams that link to this one, so archiving cannot silently break a deep link. */
  inboundLinks(id: string): string[];
  /** Records a relationship whose ends live in different diagrams. */
  addLink(link: CrossDiagramLink): Promise<CrossDiagramLink | LibraryFailure>;
  /** Removes a cross-diagram relationship. */
  removeLink(id: string): Promise<true | LibraryFailure>;
  /**
   * Rebuilds the index from the records themselves.
   *
   * The repair path for a write torn between a record and the index: entries are derived, so
   * they can always be recomputed. Authoritative facts held only by the index — links and the
   * migrated ledger — are preserved rather than recomputed, because nothing else holds them.
   */
  rebuildIndex(): Promise<LibraryIndex>;
  /**
   * Persists an open workspace and refreshes its index entry.
   *
   * "Written" means both halves landed: the record and the entry the library lists it by. If
   * the record lands but the entry's compare-and-swap loses a race, the index is re-read and
   * the entry retried once; a save that still cannot refresh the entry reports failure rather
   * than leave the dropdown describing a diagram the record no longer matches.
   */
  save(id: string): Promise<WriteOutcome>;
  index(): LibraryIndex;
}

function summaryOf(record: DiagramRecord): DiagramSummary {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    revision: record.revision,
    nodeLabels: Object.values(record.nodes).map((node) => node.label).sort(),
  };
}

function byNameThenId(left: DiagramSummary, right: DiagramSummary): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function emptyRecord(id: string, name: string): DiagramRecord {
  const layoutId = 'layout-default';
  const viewId = 'view-default';
  return {
    schemaVersion: 3,
    id: id as never,
    name,
    status: 'active',
    revision: 0,
    nodes: {},
    wires: {},
    interfaces: {},
    types: {},
    layouts: { [layoutId]: { id: layoutId as never, name: 'Default', strategy: 'manual', placements: {}, wireRouteHints: {} } },
    views: {
      [viewId]: {
        id: viewId as never,
        name: 'Default',
        layoutId: layoutId as never,
        viewport: { x: 0, y: 0, zoom: 1 },
        collapsedNodeIds: [],
        hiddenKinds: [],
      },
    },
    activeViewId: viewId as never,
    sourceRefs: [],
    appliedOperations: {},
  };
}

/**
 * Opens a diagram library over a repository.
 *
 * One workspace instance exists per diagram: opening the same diagram twice returns the same
 * workspace, because two instances would each hold their own revision and undo stack and would
 * overwrite one another with expectations that both looked current.
 */
export function createCanvasLibrary(
  repository: CanvasLibraryRepository,
  index: LibraryIndex,
  context: ActorContext,
): CanvasLibrary {
  let current = index;
  const open = new Map<string, CanvasWorkspace>();
  // The revision of each open diagram's record as this session last landed it on disk. The
  // write compare-and-swap expects against this, never against the index entry: the entry is a
  // projection a torn save can leave behind the record, and expecting against it wedges every
  // later save on a conflict the user cannot resolve.
  const lastSynced = new Map<string, number>();
  // Diagrams whose record is on disk but whose index entry is owed, because a save was torn
  // between the two writes. The next save retries the entry without rewriting the record.
  const indexDirty = new Set<string>();

  const entries = (includeArchived: boolean): DiagramSummary[] => Object.values(current.entries)
    .filter((entry) => includeArchived || entry.status === 'active')
    .sort(byNameThenId);

  /** Applies an index change under compare-and-swap; in-memory state moves only if it landed. */
  const commitIndex = async (next: LibraryIndex): Promise<WriteOutcome> => {
    const candidate = { ...next, revision: current.revision + 1 };
    const outcome = await repository.writeIndex(candidate, current.revision);
    if (outcome.status === 'written') current = candidate;
    return outcome;
  };

  const withEntry = (record: DiagramRecord): LibraryIndex => ({
    ...current,
    entries: { ...current.entries, [record.id]: summaryOf(record) },
  });

  return {
    list: (options = {}) => entries(options.includeArchived ?? false),

    search(query, options = {}) {
      const needle = query.trim().toLowerCase();
      if (needle.length === 0) return entries(options.includeArchived ?? false);
      return entries(options.includeArchived ?? false).filter((entry) =>
        entry.name.toLowerCase().includes(needle)
        || entry.nodeLabels.some((label) => label.toLowerCase().includes(needle)));
    },

    async open(id) {
      const existing = open.get(id);
      if (existing) return existing;
      if (!current.entries[id]) return { status: 'diagram-not-found', id };
      const record = await repository.readDiagram(id);
      const workspace = createCanvasWorkspace(record, context);
      open.set(id, workspace);
      lastSynced.set(id, record.revision);
      return workspace;
    },

    async create(name, id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
      if (current.entries[id]) return { status: 'diagram-already-exists', id };
      const record = emptyRecord(id, name);
      const outcome = await repository.writeDiagram(record, 0);
      if (outcome.status !== 'written') {
        return { status: 'diagram-already-exists', id };
      }
      lastSynced.set(id, record.revision);
      const committed = await commitIndex(withEntry(record));
      if (committed.status === 'stale-revision') {
        return { status: 'index-conflict', actualRevision: committed.actualRevision };
      }
      return summaryOf(record);
    },

    async setStatus(id, status) {
      const entry = current.entries[id];
      if (!entry) return { status: 'diagram-not-found', id };
      const inbound = this.inboundLinks(id);
      if (status === 'archived' && inbound.length > 0) {
        return { status: 'inbound-links-exist', links: inbound };
      }
      const record = await repository.readDiagram(id);
      const updated = { ...record, status };
      const outcome = await repository.writeDiagram(updated, record.revision);
      if (outcome.status !== 'written') return { status: 'diagram-not-found', id };
      await commitIndex(withEntry(updated));
      return summaryOf(updated);
    },

    async remove(id, options = {}) {
      if (!current.entries[id]) return { status: 'diagram-not-found', id };
      const inbound = this.inboundLinks(id);
      if (inbound.length > 0 && !options.force) {
        return { status: 'inbound-links-exist', links: inbound };
      }
      await repository.deleteDiagram(id);
      const remaining = { ...current.entries };
      delete remaining[id];
      open.delete(id);
      lastSynced.delete(id);
      indexDirty.delete(id);
      await commitIndex({
        ...current,
        entries: remaining,
        links: Object.fromEntries(Object.entries(current.links).filter(
          ([, link]) => link.source.diagramId !== id && link.target.diagramId !== id,
        )),
      });
      return true;
    },

    inboundLinks(id) {
      const fromLinks = Object.values(current.links)
        .filter((link) => link.target.diagramId === id)
        .map((link) => link.id as string);
      return [...new Set(fromLinks)].sort();
    },

    async save(id) {
      const workspace = open.get(id);
      if (!workspace) return { status: 'save-failed', reason: `not-open:${id}` };
      const record = workspace.snapshot();
      const synced = lastSynced.get(id) ?? record.revision;
      if (synced !== record.revision) {
        const outcome = await repository.writeDiagram(record, synced);
        // A genuine external edit conflicts here and is surfaced, never retried into an
        // overwrite: reconciliation is for the derived index, not the authoritative record.
        if (outcome.status !== 'written') return outcome;
        // The record moved even if the index commit below fails, so the marker advances now
        // and the entry is marked owed; otherwise the next save would expect a revision the
        // file no longer has and conflict forever.
        lastSynced.set(id, record.revision);
        indexDirty.add(id);
      } else if (!indexDirty.has(id)) {
        return { status: 'written', revision: record.revision };
      }
      const committed = await commitIndex(withEntry(record));
      if (committed.status === 'written') {
        indexDirty.delete(id);
        return { status: 'written', revision: record.revision };
      }
      if (committed.status !== 'stale-revision') return committed;
      // Another writer moved the index under this save. The entry is derived from the record,
      // so re-read the index and retry once against its current revision; the record itself is
      // already on disk and is not rewritten. A second conflict means the index is contended,
      // and the save must say so rather than report "written" over a stale dropdown.
      current = await repository.readIndex();
      const retried = await commitIndex(withEntry(record));
      if (retried.status === 'written') {
        indexDirty.delete(id);
        return { status: 'written', revision: record.revision };
      }
      return { status: 'save-failed', reason: `index-conflict:${retried.status}` };
    },

    async addLink(link) {
      for (const end of [link.source, link.target]) {
        if (!current.entries[end.diagramId]) {
          return { status: 'diagram-not-found', id: end.diagramId };
        }
      }
      await commitIndex({ ...current, links: { ...current.links, [link.id]: link } });
      return link;
    },

    async removeLink(id) {
      if (!current.links[id]) return { status: 'link-not-found', id };
      const remaining = { ...current.links };
      delete remaining[id];
      await commitIndex({ ...current, links: remaining });
      return true;
    },

    async rebuildIndex() {
      const ids = await repository.listDiagramIds();
      const entries: Record<string, DiagramSummary> = {};
      for (const id of ids) {
        entries[id] = summaryOf(await repository.readDiagram(id));
      }
      // Links and the migrated ledger are authoritative here and exist nowhere else, so they
      // are carried across rather than recomputed. Links pointing at a vanished diagram are
      // dropped, because a link to nothing is not a fact worth keeping.
      const links = Object.fromEntries(Object.entries(current.links).filter(
        ([, link]) => entries[link.source.diagramId] && entries[link.target.diagramId],
      ));
      await commitIndex({ ...current, entries, links });
      return current;
    },

    index: () => current,
  };
}
