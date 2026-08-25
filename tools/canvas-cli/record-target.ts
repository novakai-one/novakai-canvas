/** Builds the laid-out record a compiled DSL scope describes. */

import type { DiagramRecord } from '../../src/canvas.ts';
import type { CompiledDiagram } from './compile.ts';
import {
  asId, layoutInitialRecord, PLACEHOLDER_PLACEMENT, placementsOf, type RecordPlacement,
} from './record-graph.ts';
import { placeCompiledInsertions } from './record-insertion.ts';

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
  const placements = Object.fromEntries(Object.keys(compiled.nodes).map((nodeId) => [nodeId,
    existing[nodeId]
      ? structuredClone(existing[nodeId])
      : { nodeId: asId(nodeId), ...structuredClone(PLACEHOLDER_PLACEMENT) },
  ])) as Record<string, RecordPlacement>;

  // The scope block fully declares the map, so an omitted orientation clears a stored one.
  const { orientation: _replaced, flows: _replacedFlows, ...carried } = before;
  const views = structuredClone(before.views);
  for (const view of Object.values(views)) {
    if (view.flowId && !compiled.flows[view.flowId]) delete view.flowId;
  }
  const target: DiagramRecord = {
    ...carried,
    ...(compiled.orientation === undefined ? {} : { orientation: compiled.orientation }),
    name: compiled.name,
    nodes: compiled.nodes,
    wires: compiled.wires,
    ...(Object.keys(compiled.flows).length === 0 ? {} : { flows: compiled.flows }),
    interfaces: compiled.interfaces,
    types: compiled.types,
    views,
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
  };
  return Object.keys(before.nodes).length === 0
    ? layoutInitialRecord(target)
    : placeCompiledInsertions(before, target);
}
