import type { ArchitectureDocument } from '../../../contract/records/legacy.ts';
import { asId } from '../id-cast.ts';
import type { DiagramId, LinkId, NodeId } from '../../../contract/brands.ts';
import type {
  CrossDiagramLink, DiagramRecord, LibraryEntry, LibraryIndex, MigratedLibrary, MigrationReport,
} from '../../../contract/records/index.ts';
import { buildRecord, descendantsOf } from './record-builder.ts';

const UNFILED_DIAGRAM_ID = 'unfiled';
/**
 * Splits one legacy document into independent diagram records.
 *
 * Three facts in the real data have no obvious home and are handled explicitly rather than
 * silently: a wire whose ends sit in different diagrams becomes a library link, nodes belonging
 * to no diagram at all go to a visible Unfiled diagram, and the document-global idempotency
 * ledger is carried to the library so a replayed pre-migration operation is still recognised.
 */
export function migrateDocumentToLibrary(
  document: ArchitectureDocument,
  options: { fromSchemaVersion?: 1 | 2 } = {},
): MigratedLibrary {
  const startingRevision = document.revision + 1;
  const records: Record<string, DiagramRecord> = {};
  const diagramOfNode = new Map<string, string>();

  for (const diagram of Object.values(document.diagrams)) {
    const nodeIds = descendantsOf(document, diagram.rootNodeId);
    for (const nodeId of nodeIds) diagramOfNode.set(nodeId, diagram.id);
    records[diagram.id] = buildRecord(document, {
      id: diagram.id,
      name: document.nodes[diagram.rootNodeId]?.label ?? diagram.id,
      status: diagram.status,
      nodeIds,
      revision: startingRevision,
      subjectRef: diagram.subjectRef,
      sourceRefs: diagram.sourceRefs,
    });
  }

  const unfiledIds = new Set(Object.keys(document.nodes).filter((id) => !diagramOfNode.has(id)));
  const unfiledNodeIds: NodeId[] = [];
  if (unfiledIds.size > 0) {
    for (const nodeId of unfiledIds) {
      diagramOfNode.set(nodeId, UNFILED_DIAGRAM_ID);
      unfiledNodeIds.push(asId<NodeId>(nodeId));
    }
    records[UNFILED_DIAGRAM_ID] = buildRecord(document, {
      id: UNFILED_DIAGRAM_ID,
      name: 'Unfiled',
      status: 'active',
      nodeIds: unfiledIds,
      revision: startingRevision,
      sourceRefs: [],
    });
  }

  const links: Record<string, CrossDiagramLink> = {};
  for (const wire of Object.values(document.wires)) {
    const sourceDiagram = diagramOfNode.get(wire.source);
    const targetDiagram = diagramOfNode.get(wire.target);
    if (!sourceDiagram || !targetDiagram || sourceDiagram === targetDiagram) continue;
    links[wire.id] = {
      id: asId<LinkId>(wire.id),
      kind: wire.kind,
      label: wire.label,
      source: { diagramId: asId<DiagramId>(sourceDiagram), nodeId: asId<NodeId>(wire.source) },
      target: { diagramId: asId<DiagramId>(targetDiagram), nodeId: asId<NodeId>(wire.target) },
    };
  }

  const entries: Record<string, LibraryEntry> = Object.fromEntries(
    Object.values(records).map((record) => [record.id, {
      id: record.id,
      name: record.name,
      status: record.status,
      revision: record.revision,
      nodeLabels: Object.values(record.nodes).map((node) => node.label).sort(),
    }]),
  );

  const carriedOperationIds = Object.keys(document.appliedOperations).sort();
  const index: LibraryIndex = {
    schemaVersion: 3,
    revision: 1,
    entries,
    links,
    migratedOperations: structuredClone(document.appliedOperations),
  };

  // A type referenced from two records would be written into both, making two authorities for
  // one definition. No real file does this today; reporting it means the day one does is the
  // day it is seen, not the day the copies drift.
  const typeOwners = new Map<string, Set<string>>();
  for (const record of Object.values(records)) {
    for (const typeId of Object.keys(record.types)) {
      const owners = typeOwners.get(typeId) ?? new Set<string>();
      owners.add(record.id);
      typeOwners.set(typeId, owners);
    }
  }

  const report: MigrationReport = {
    fromSchemaVersion: options.fromSchemaVersion ?? 2,
    diagramsCreated: Object.keys(records).length,
    sharedTypeIds: [...typeOwners.entries()]
      .filter(([, owners]) => owners.size > 1)
      .map(([typeId]) => asId<never>(typeId))
      .sort(),
    unfiledNodeIds,
    crossDiagramLinkIds: Object.keys(links).map((id) => asId<LinkId>(id)),
    carriedOperationIds,
    startingRevision,
  };

  return { index, records, report };
}
