import type { DiagramRecord } from '../../../contract/records/index.ts';
import {
  asId, layoutInitialRecord, PLACEHOLDER_PLACEMENT, placementsOf, type RecordPlacement,
} from './record-graph.ts';

function subset<T>(source: Record<string, T>, ids: ReadonlySet<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(source).filter(([id]) => ids.has(id)));
}

function syntheticIdFor(record: DiagramRecord, ordinal: number): string {
  let id = `__canvas-cli-insertion-${ordinal}`;
  while (record.nodes[id]) id = `_${id}`;
  return id;
}

export function descendantIds(
  record: DiagramRecord, rootIds: readonly string[], permitted: ReadonlySet<string>,
): string[] {
  const found = [...rootIds];
  for (let index = 0; index < found.length; index += 1) {
    const parentId = found[index];
    for (const [id, node] of Object.entries(record.nodes)) {
      if (permitted.has(id) && node.parentId === parentId && !found.includes(id)) found.push(id);
    }
  }
  return found;
}

/** Builds a temporary blank diagram so established measurement/layout can size a new subtree. */
function insertionSlice(
  target: DiagramRecord, rootIds: readonly string[], nodeIds: readonly string[], ordinal: number,
): DiagramRecord {
  const layoutId = 'layout-insertion';
  const viewId = 'view-insertion';
  const syntheticId = syntheticIdFor(target, ordinal);
  const included = new Set(nodeIds);
  const roots = new Set(rootIds);
  const sourceLayout = target.layouts[target.views[target.activeViewId].layoutId];
  const nodes = Object.fromEntries(nodeIds.map((id) => [id, {
    ...structuredClone(target.nodes[id]),
    ...(roots.has(id) ? { parentId: syntheticId as never } : {}),
  }])) as DiagramRecord['nodes'];
  nodes[syntheticId] = {
    id: asId(syntheticId), kind: 'group', label: 'CLI insertion', interfaceIds: [], typeIds: [],
  };
  const placements = Object.fromEntries([syntheticId, ...nodeIds].map((id) => [id, {
    nodeId: asId(id), ...structuredClone(PLACEHOLDER_PLACEMENT),
  }])) as Record<string, RecordPlacement>;
  return {
    schemaVersion: 3, id: target.id, name: target.name, status: target.status,
    revision: target.revision, nodes,
    wires: Object.fromEntries(Object.entries(target.wires).filter(([, wire]) =>
      included.has(wire.source.nodeId as string) && included.has(wire.target.nodeId as string))),
    interfaces: target.interfaces, types: target.types,
    layouts: {
      [layoutId]: {
        id: asId(layoutId), name: 'Insertion', strategy: 'manual', placements, wireRouteHints: {},
        appearanceByNodeId: subset(sourceLayout.appearanceByNodeId ?? {}, included),
        appearanceByWireId: {},
        arrangementByContainerId: subset(sourceLayout.arrangementByContainerId ?? {}, included),
      },
    },
    views: {
      [viewId]: {
        id: asId(viewId), name: 'Insertion', layoutId: asId(layoutId),
        viewport: { x: 0, y: 0, zoom: 1 }, collapsedNodeIds: [], hiddenKinds: [],
      },
    },
    activeViewId: asId(viewId), sourceRefs: [], appliedOperations: {},
  };
}

export function copyMeasuredSubtree(
  target: DiagramRecord, rootIds: readonly string[], nodeIds: readonly string[], ordinal: number,
): void {
  const measured = layoutInitialRecord(insertionSlice(target, rootIds, nodeIds, ordinal));
  const measuredPlacements = placementsOf(measured);
  const targetPlacements = placementsOf(target);
  for (const id of nodeIds) targetPlacements[id] = structuredClone(measuredPlacements[id]);
}
