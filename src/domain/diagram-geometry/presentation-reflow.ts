import type { ArchitectureDocument, CanvasNode as LegacyNode, NodePlacement } from '../model.ts';
import type { DiagramRecord } from '../records.ts';
import { layoutContainer } from './container.ts';
import { LayoutState } from './state.ts';

const GROUP_PADDING = 40;

export interface PresentationReflowRequest {
  /** Nodes whose component measurement may have changed. */
  resizedNodeIds?: readonly string[];
  /** Nodes or containers whose nearest authored arrangement must run again. */
  arrangementAffectedIds?: readonly string[];
}

function active(record: DiagramRecord) {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  const layout = record.layouts[view.layoutId];
  if (!layout) throw new Error(`unknown-layout:${view.layoutId}`);
  return { view, layout };
}

/** Narrow compatibility adapter for the established geometry engine's working document. */
function geometryDocument(record: DiagramRecord): ArchitectureDocument {
  const { view, layout } = active(record);
  return {
    schemaVersion: 2,
    id: record.id as string,
    name: record.name,
    revision: record.revision,
    nodes: Object.fromEntries(Object.entries(record.nodes).map(([id, node]) => [id, {
      ...node,
      kind: node.kind === 'group' ? 'scope' : node.kind,
    }])) as Record<string, LegacyNode>,
    interfaces: record.interfaces as ArchitectureDocument['interfaces'],
    types: record.types as ArchitectureDocument['types'],
    wires: Object.fromEntries(Object.entries(record.wires).map(([id, wire]) => [id, {
      id, kind: wire.kind, label: wire.label,
      source: wire.source.nodeId as string,
      target: wire.target.nodeId as string,
      routing: 'elbow' as const,
    }])),
    activeLayoutId: layout.id as string,
    layouts: {
      [layout.id]: {
        ...layout,
        id: layout.id as string,
        collapsedNodeIds: view.collapsedNodeIds as string[],
      },
    } as ArchitectureDocument['layouts'],
    diagrams: {},
    appliedOperations: record.appliedOperations as ArchitectureDocument['appliedOperations'],
  };
}

function arrangementRoot(record: DiagramRecord, startId: string): string | undefined {
  const { layout } = active(record);
  let cursor: string | undefined = startId;
  let root: string | undefined;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    if (layout.arrangementByContainerId?.[cursor]) root = cursor;
    cursor = record.nodes[cursor]?.parentId as string | undefined;
  }
  return root;
}

function growAncestorBounds(state: LayoutState, childId: string): void {
  let currentId = childId;
  let parentId = state.document.nodes[currentId]?.parentId;
  while (parentId) {
    const child = state.document.nodes[currentId];
    const parent = state.document.nodes[parentId];
    state.document.nodes[parentId] = {
      ...parent,
      size: {
        width: Math.max(parent.size.width, child.position.x + child.size.width + state.groupPadding),
        height: Math.max(parent.size.height, child.position.y + child.size.height + state.groupPadding),
      },
    };
    currentId = parentId;
    parentId = state.document.nodes[currentId]?.parentId;
  }
}

function placements(state: LayoutState): Record<string, NodePlacement> {
  return Object.fromEntries(Object.entries(state.document.nodes).map(([id, node]) => [id, {
    nodeId: id,
    position: node.position,
    size: node.size,
    pinned: state.layout.placements[id]?.pinned ?? false,
  }]));
}

/** Remeasures changed nodes and reruns only their outermost authored arrangements. */
export function reflowPresentation(
  record: DiagramRecord,
  request: PresentationReflowRequest,
): DiagramRecord {
  const { layout } = active(record);
  const state = LayoutState.create(geometryDocument(record), layout.id, GROUP_PADDING);
  const resized = [...new Set(request.resizedNodeIds ?? [])].filter((id) => state.document.nodes[id]);
  for (const id of resized) {
    const node = state.document.nodes[id];
    if (node.kind !== 'scope') state.document.nodes[id] = { ...node, size: state.measureNode(id) };
  }

  const affected = [...resized, ...(request.arrangementAffectedIds ?? [])];
  const roots = [...new Set(affected.map((id) => arrangementRoot(record, id)).filter(Boolean))]
    .sort() as string[];
  for (const containerId of roots) {
    const container = state.document.nodes[containerId];
    if (!container) continue;
    state.document.nodes[containerId] = {
      ...container,
      size: layoutContainer(state, containerId),
    };
    growAncestorBounds(state, containerId);
  }
  for (const id of resized) if (!arrangementRoot(record, id)) growAncestorBounds(state, id);

  return {
    ...record,
    layouts: {
      ...record.layouts,
      [layout.id]: { ...layout, placements: placements(state) as typeof layout.placements },
    },
  };
}
