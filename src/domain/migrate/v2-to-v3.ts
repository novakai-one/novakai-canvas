import type { ArchitectureDocument, CanvasWire as LegacyWire } from '../model.ts';
import { asId } from '../ids.ts';
import type { DiagramId, LinkId, NodeId, ViewId } from '../ids.ts';
import type {
  CanvasLayout, CanvasNode, CanvasView, CanvasWire, CrossDiagramLink, DiagramRecord,
  LibraryEntry, LibraryIndex, MigratedLibrary, MigrationReport, NodeKind, NodePlacement,
} from '../records.ts';

const DEFAULT_LAYOUT_ID = 'layout-default';
const DEFAULT_VIEW_ID = 'view-default';
const UNFILED_DIAGRAM_ID = 'unfiled';

/**
 * The root scope node is KEPT as a group node rather than dissolved into the record.
 *
 * Dissolving it looked cleaner on paper, but child placements are stored relative to their
 * parent (`extent: 'parent'` in the renderer — a node at x:36 inside a group at x:576 is drawn
 * at 612). Removing the parent would silently relocate every top-level node to near the origin
 * and delete the framed outer box the diagram is drawn inside. The record owns the diagram's
 * identity and title; the group node remains what it always was — a drawn frame.
 */
function nodeKindOf(kind: string): NodeKind {
  return kind === 'scope' ? 'group' : kind as NodeKind;
}

function descendantsOf(document: ArchitectureDocument, rootId: string): Set<string> {
  const included = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(document.nodes)) {
      if (node.parentId && included.has(node.parentId) && !included.has(node.id)) {
        included.add(node.id);
        changed = true;
      }
    }
  }
  return included;
}

function migrateNode(node: ArchitectureDocument['nodes'][string]): CanvasNode {
  const migrated: CanvasNode = {
    id: asId<NodeId>(node.id),
    kind: nodeKindOf(node.kind),
    label: node.label,
    interfaceIds: node.interfaceIds.map((id) => asId<never>(id)),
    typeIds: node.typeIds.map((id) => asId<never>(id)),
  };
  if (node.description !== undefined) migrated.description = node.description;
  if (node.parentId !== undefined) migrated.parentId = asId<NodeId>(node.parentId);
  if (node.rows !== undefined) migrated.rows = node.rows;
  if (node.subjectRef !== undefined) migrated.subjectRef = node.subjectRef;
  if (node.expandsToDiagramId !== undefined) {
    migrated.expandsToDiagramId = asId<DiagramId>(node.expandsToDiagramId);
  }
  return migrated;
}

/** Endpoints keep node identity only; anchors are opt-in and nothing legacy had one. */
function migrateWire(wire: LegacyWire): CanvasWire {
  return {
    id: asId<never>(wire.id),
    kind: wire.kind,
    label: wire.label,
    source: { nodeId: asId<NodeId>(wire.source) },
    target: { nodeId: asId<NodeId>(wire.target) },
  };
}

function pick<T>(source: Record<string, T>, keys: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => keys.has(key)));
}

function buildRecord(
  document: ArchitectureDocument,
  options: {
    id: string; name: string; status: 'active' | 'archived'; nodeIds: Set<string>;
    revision: number; subjectRef?: ArchitectureDocument['diagrams'][string]['subjectRef'];
    sourceRefs: ArchitectureDocument['diagrams'][string]['sourceRefs'];
  },
): DiagramRecord {
  const { nodeIds } = options;
  const legacyLayout = document.layouts[document.activeLayoutId];
  const nodes = Object.fromEntries(
    Object.values(pick(document.nodes, nodeIds)).map((node) => [node.id, migrateNode(node)]),
  );
  const wires = Object.fromEntries(Object.values(document.wires)
    .filter((wire) => nodeIds.has(wire.source) && nodeIds.has(wire.target))
    .map((wire) => [wire.id, migrateWire(wire)]));

  const interfaceIds = new Set(Object.values(nodes).flatMap((node) => node.interfaceIds as string[]));
  const typeIds = new Set(Object.values(nodes).flatMap((node) => node.typeIds as string[]));
  const placements: Record<string, NodePlacement> = Object.fromEntries(
    Object.values(legacyLayout?.placements ?? {})
      .filter((placement) => nodeIds.has(placement.nodeId))
      .map((placement) => [placement.nodeId, {
        nodeId: asId<NodeId>(placement.nodeId),
        position: placement.position,
        size: placement.size,
        pinned: placement.pinned,
      }]),
  );

  const layout: CanvasLayout = {
    id: asId<never>(DEFAULT_LAYOUT_ID),
    name: legacyLayout?.name ?? 'Default',
    strategy: legacyLayout?.strategy ?? 'manual',
    placements,
    wireRouteHints: Object.fromEntries(Object.values(legacyLayout?.wireRouteHints ?? {})
      .filter((hint) => wires[hint.wireId])
      .map((hint) => [hint.wireId, { ...hint, wireId: asId<never>(hint.wireId) }])),
  };

  const view: CanvasView = {
    id: asId<ViewId>(DEFAULT_VIEW_ID),
    name: 'Default',
    layoutId: layout.id,
    viewport: { x: 0, y: 0, zoom: 1 },
    collapsedNodeIds: (legacyLayout?.collapsedNodeIds ?? [])
      .filter((id) => nodeIds.has(id))
      .map((id) => asId<NodeId>(id)),
    hiddenKinds: [],
  };

  const record: DiagramRecord = {
    schemaVersion: 3,
    id: asId<DiagramId>(options.id),
    name: options.name,
    status: options.status,
    revision: options.revision,
    nodes,
    wires,
    interfaces: pick(document.interfaces, interfaceIds),
    types: pick(document.types, typeIds),
    layouts: { [layout.id]: layout },
    views: { [view.id]: view },
    activeViewId: view.id,
    sourceRefs: options.sourceRefs,
    appliedOperations: {},
  };
  if (options.subjectRef !== undefined) record.subjectRef = options.subjectRef;
  return record;
}

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
