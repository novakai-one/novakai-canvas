import type { DiagramRecord, LibraryIndex } from '../../contract/records/index.ts';
import type { CanvasLibrary, DiagramSummary } from '../../contract/library.ts';
import type { CanvasLibraryRepository, WriteOutcome } from '../../contract/ports/library-repository.ts';
import type { ActorContext, CanvasWorkspace } from '../../contract/workspace.ts';
import { createCanvasWorkspace } from './canvas-workspace.ts';
import { byNameThenId, emptyRecord, summaryOf } from './canvas-library-records.ts';

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
  // Compare authoritative record writes against the revision this session last landed.
  const lastSynced = new Map<string, number>();
  // Tracks a record already written whose derived index entry is still owed.
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
