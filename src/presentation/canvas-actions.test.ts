import { describe, expect, it } from 'vitest';
import { asId } from '../domain/id-cast';
import type { NodeId } from '../domain/ids';
import type { DiagramRecord } from '../domain/records';
import { createCanvasNode, rootGroupId } from './canvas-actions';

const record: DiagramRecord = {
  schemaVersion: 3,
  id: asId('map'),
  name: 'Map',
  status: 'active',
  revision: 1,
  nodes: {
    map: {
      id: asId<NodeId>('map'), kind: 'group', label: 'Map', interfaceIds: [], typeIds: [],
    },
  },
  wires: {},
  interfaces: {},
  types: {},
  layouts: {
    'layout-default': {
      id: asId('layout-default'),
      name: 'Default',
      strategy: 'manual',
      placements: {},
      wireRouteHints: {},
    },
  },
  views: {
    'view-default': {
      id: asId('view-default'),
      name: 'Default',
      layoutId: asId('layout-default'),
      viewport: { x: 0, y: 0, zoom: 1 },
      collapsedNodeIds: [],
      hiddenKinds: [],
    },
  },
  activeViewId: asId('view-default'),
  sourceRefs: [],
  appliedOperations: {},
};

describe('createCanvasNode', () => {
  it.each(['module', 'object', 'runtime', 'resource', 'comment', 'group'] as const)('creates a %s inside the diagram root', (kind) => {
    const created = createCanvasNode(record, asId<NodeId>('map'), kind, `${kind}-1`);
    expect(created.node.parentId).toBe('map');
    expect(created.node.id).toBe(`${kind}-1`);
    // The record model names a container `group`; nothing translates the kind on the way in.
    expect(created.node.kind).toBe(kind);
    expect(created.placement.size.width).toBeGreaterThan(0);
  });

  it('places a new object at the top level when the diagram has no root group', () => {
    const empty = { ...record, nodes: {} };
    const created = createCanvasNode(empty, rootGroupId(empty), 'module', 'module-1');
    expect(created.node.parentId).toBeUndefined();
  });
});

describe('rootGroupId', () => {
  it('finds the one group that has no parent', () => {
    expect(rootGroupId(record)).toBe('map');
  });
});
