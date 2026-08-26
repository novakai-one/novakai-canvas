import type { ArchitectureDocument, CanvasWire as LegacyWire } from '../../../contract/records/legacy.ts';
import type { DiagramId, NodeId, ViewId } from '../../../contract/brands.ts';
import type {
  CanvasLayout, CanvasNode, CanvasView, CanvasWire, DiagramRecord, NodeKind, NodePlacement,
} from '../../../contract/records/index.ts';
import { asId } from '../id-cast.ts';

const DEFAULT_LAYOUT_ID = 'layout-default';
const DEFAULT_VIEW_ID = 'view-default';

function nodeKindOf(kind: string): NodeKind {
  return kind === 'scope' ? 'group' : kind as NodeKind;
}

export function descendantsOf(document: ArchitectureDocument, rootId: string): Set<string> {
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
    id: asId<NodeId>(node.id), kind: nodeKindOf(node.kind), label: node.label,
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

function migrateWire(wire: LegacyWire): CanvasWire {
  return {
    id: asId<never>(wire.id), kind: wire.kind, label: wire.label,
    source: { nodeId: asId<NodeId>(wire.source) },
    target: { nodeId: asId<NodeId>(wire.target) },
  };
}

function pick<T>(source: Record<string, T>, keys: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => keys.has(key)));
}

export function buildRecord(
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
        nodeId: asId<NodeId>(placement.nodeId), position: placement.position,
        size: placement.size, pinned: placement.pinned,
      }]),
  );
  const layout: CanvasLayout = {
    id: asId<never>(DEFAULT_LAYOUT_ID), name: legacyLayout?.name ?? 'Default',
    strategy: legacyLayout?.strategy ?? 'manual', placements,
    wireRouteHints: Object.fromEntries(Object.values(legacyLayout?.wireRouteHints ?? {})
      .filter((hint) => wires[hint.wireId])
      .map((hint) => [hint.wireId, { ...hint, wireId: asId<never>(hint.wireId) }])),
  };
  const view: CanvasView = {
    id: asId<ViewId>(DEFAULT_VIEW_ID), name: 'Default', layoutId: layout.id,
    viewport: { x: 0, y: 0, zoom: 1 },
    collapsedNodeIds: (legacyLayout?.collapsedNodeIds ?? [])
      .filter((id) => nodeIds.has(id)).map((id) => asId<NodeId>(id)),
    hiddenKinds: [],
  };
  const record: DiagramRecord = {
    schemaVersion: 3, id: asId<DiagramId>(options.id), name: options.name,
    status: options.status, revision: options.revision, nodes, wires,
    interfaces: pick(document.interfaces, interfaceIds), types: pick(document.types, typeIds),
    layouts: { [layout.id]: layout }, views: { [view.id]: view }, activeViewId: view.id,
    sourceRefs: options.sourceRefs, appliedOperations: {},
  };
  if (options.subjectRef !== undefined) record.subjectRef = options.subjectRef;
  return record;
}
