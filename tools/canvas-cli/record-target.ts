/** Builds the laid-out record a compiled DSL scope describes. */

import type { DiagramRecord } from '../../src/canvas.ts';
import type { CompiledDiagram } from './compile.ts';
import {
  asId, layoutRecord, placementsOf, type RecordPlacement,
} from './record-graph.ts';

/** Geometry used only until automatic layout resolves a new node. */
export const PLACEHOLDER: Omit<RecordPlacement, 'nodeId'> = {
  position: { x: 0, y: 0 },
  size: { width: 1, height: 1 },
  pinned: false,
};

/** An empty record with one default layout and one default view. */
export function blankRecord(id: string, name: string): DiagramRecord {
  const layoutId = 'layout-default';
  const viewId = 'view-default';
  return {
    schemaVersion: 3,
    id: asId(id),
    name,
    status: 'active',
    revision: 0,
    nodes: {},
    wires: {},
    interfaces: {},
    types: {},
    layouts: {
      [layoutId]: {
        id: asId(layoutId), name: 'Default', strategy: 'manual', placements: {}, wireRouteHints: {},
        appearanceByNodeId: {}, appearanceByWireId: {}, arrangementByContainerId: {},
      },
    },
    views: {
      [viewId]: {
        id: asId(viewId),
        name: 'Default',
        layoutId: asId(layoutId),
        viewport: { x: 0, y: 0, zoom: 1 },
        collapsedNodeIds: [],
        hiddenKinds: [],
      },
    },
    activeViewId: asId(viewId),
    sourceRefs: [],
    appliedOperations: {},
  };
}

/** Builds and lays out the record the DSL describes without touching storage. */
export function recordForCompiled(before: DiagramRecord, compiled: CompiledDiagram): DiagramRecord {
  const layoutId = before.views[before.activeViewId].layoutId as string;
  const existing = placementsOf(before);
  const placements = Object.fromEntries(Object.keys(compiled.nodes).map((nodeId) => [nodeId, {
    nodeId: asId(nodeId),
    ...structuredClone(existing[nodeId] ? {
      position: existing[nodeId].position,
      size: existing[nodeId].size,
      pinned: existing[nodeId].pinned,
    } : PLACEHOLDER),
  }])) as Record<string, RecordPlacement>;

  return layoutRecord({
    ...before,
    name: compiled.name,
    nodes: compiled.nodes,
    wires: compiled.wires,
    interfaces: compiled.interfaces,
    types: compiled.types,
    layouts: {
      ...before.layouts,
      [layoutId]: {
        ...before.layouts[layoutId],
        placements,
        wireRouteHints: Object.fromEntries(Object.entries(before.layouts[layoutId].wireRouteHints)
          .filter(([wireId]) => compiled.wires[wireId])),
        appearanceByNodeId: structuredClone(compiled.appearanceByNodeId),
        appearanceByWireId: structuredClone(compiled.appearanceByWireId),
        arrangementByContainerId: structuredClone(compiled.arrangementByContainerId),
      },
    },
  });
}
