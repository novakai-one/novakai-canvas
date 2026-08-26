import type { DiagramSummary } from '../../contract/library.ts';
import type { DiagramRecord } from '../../contract/records/index.ts';

export function summaryOf(record: DiagramRecord): DiagramSummary {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    revision: record.revision,
    nodeLabels: Object.values(record.nodes).map((node) => node.label).sort(),
  };
}

export function byNameThenId(left: DiagramSummary, right: DiagramSummary): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

export function emptyRecord(id: string, name: string): DiagramRecord {
  const layoutId = 'layout-default';
  const viewId = 'view-default';
  return {
    schemaVersion: 3, id: id as never, name, status: 'active', revision: 0,
    nodes: {}, wires: {}, interfaces: {}, types: {},
    layouts: {
      [layoutId]: {
        id: layoutId as never, name: 'Default', strategy: 'manual',
        placements: {}, wireRouteHints: {},
      },
    },
    views: {
      [viewId]: {
        id: viewId as never, name: 'Default', layoutId: layoutId as never,
        viewport: { x: 0, y: 0, zoom: 1 }, collapsedNodeIds: [], hiddenKinds: [],
      },
    },
    activeViewId: viewId as never, sourceRefs: [], appliedOperations: {},
  };
}
