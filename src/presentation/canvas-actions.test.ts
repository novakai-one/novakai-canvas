import { describe, expect, it } from 'vitest';
import { asId } from '../domain/id-cast';
import type { NodeId } from '../domain/ids';
import type { DiagramRecord } from '../domain/records';
import {
  containingGroup, createCanvasNode, escapeStep, resolveDrop, selectionResolves,
  type PlacedNode,
} from './canvas-actions';

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

/**
 * A root frame at the origin, an inner frame inside it, and one module inside that.
 *
 *   root   (0,0)   1000 x 800
 *     inner (100,100) → absolute (100,100), 400 x 300
 *       leaf (20,20)  → absolute (120,120), 200 x 100
 */
const placed: PlacedNode[] = [
  { id: 'root', kind: 'group', position: { x: 0, y: 0 }, size: { width: 1000, height: 800 } },
  { id: 'inner', kind: 'group', parentId: 'root', position: { x: 100, y: 100 }, size: { width: 400, height: 300 } },
  { id: 'leaf', kind: 'module', parentId: 'inner', position: { x: 20, y: 20 }, size: { width: 200, height: 100 } },
];

describe('containingGroup', () => {
  it('picks the innermost frame a point falls in', () => {
    expect(containingGroup(placed, { x: 200, y: 200 })).toBe('inner');
  });

  it('falls back to the outer frame outside the inner one', () => {
    expect(containingGroup(placed, { x: 800, y: 700 })).toBe('root');
  });

  it('answers with no frame at all outside every group — a true canvas has an outside', () => {
    expect(containingGroup(placed, { x: 2400, y: 2400 })).toBeUndefined();
  });

  it('never swallows a group into itself or into what it contains', () => {
    expect(containingGroup(placed, { x: 200, y: 200 }, 'inner')).toBe('root');
    expect(containingGroup(placed, { x: 200, y: 200 }, 'root')).toBeUndefined();
  });
});

describe('resolveDrop', () => {
  it('keeps a node where it was dropped when the frame does not change', () => {
    expect(resolveDrop(placed, 'leaf', { x: 40, y: 40 }, 'inner'))
      .toEqual({ parentId: 'inner', position: { x: 40, y: 40 } });
  });

  it('adopts a node dropped into another frame, re-expressed in that frame', () => {
    // Dropped at absolute (700, 500): outside `inner`, still inside `root`.
    expect(resolveDrop(placed, 'leaf', { x: 600, y: 400 }, 'inner'))
      .toEqual({ parentId: 'root', position: { x: 700, y: 500 } });
  });

  it('lets a node leave every group — a group is never a wall', () => {
    expect(resolveDrop(placed, 'leaf', { x: 2000, y: 2000 }, 'inner'))
      .toEqual({ parentId: undefined, position: { x: 2100, y: 2100 } });
  });

  it('decides membership by the node\'s centre, not its corner', () => {
    // Top-left at absolute (480, 200) is inside `inner`; the centre (580, 250) is not.
    expect(resolveDrop(placed, 'leaf', { x: 380, y: 100 }, 'inner').parentId).toBe('root');
  });

  it('refuses to put a group inside its own child', () => {
    expect(resolveDrop(placed, 'root', { x: 150, y: 150 }).parentId).toBeUndefined();
  });
});

describe('createCanvasNode', () => {
  it.each(['module', 'object', 'runtime', 'resource', 'comment', 'group', 'block'] as const)('centres a new %s on the point the user chose', (kind) => {
    const created = createCanvasNode(placed, kind, `${kind}-1`, { x: 200, y: 200 });
    expect(created.node.parentId).toBe('inner');
    expect(created.node.id).toBe(`${kind}-1`);
    // The record model names a container `group`; nothing translates the kind on the way in.
    expect(created.node.kind).toBe(kind);
    expect(created.placement.size.width).toBeGreaterThan(0);
    // Relative to `inner`, whose origin is absolute (100, 100).
    expect(created.placement.position).toEqual({
      x: 100 - created.placement.size.width / 2,
      y: 100 - created.placement.size.height / 2,
    });
    if (kind === 'block') {
      expect(created.placement.size).toEqual({ width: 280, height: 140 });
      expect(created.placement.sizeMode).toBe('manual');
    }
  });

  it('places at the top level when the user is looking outside every group', () => {
    const created = createCanvasNode(placed, 'module', 'module-1', { x: 3000, y: 3000 });
    expect(created.node.parentId).toBeUndefined();
    expect(created.placement.position).toEqual({ x: 2900, y: 2945 });
  });

  it('places at the top level when the diagram has nothing drawn yet', () => {
    expect(createCanvasNode([], 'module', 'module-1', { x: 0, y: 0 }).node.parentId).toBeUndefined();
  });
});

/** A root group holding an inner group holding one module, plus one wire between two modules. */
const nested: DiagramRecord = {
  ...record,
  nodes: {
    map: record.nodes.map,
    inner: {
      id: asId<NodeId>('inner'), kind: 'group', label: 'Inner', parentId: asId<NodeId>('map'), interfaceIds: [], typeIds: [],
    },
    leaf: {
      id: asId<NodeId>('leaf'), kind: 'module', label: 'Leaf', parentId: asId<NodeId>('inner'), interfaceIds: [], typeIds: [],
    },
    tree: {
      id: asId<NodeId>('tree'), kind: 'tree', label: 'Tree', parentId: asId<NodeId>('inner'),
      interfaceIds: [], typeIds: [], rows: [{ id: 'row', kind: 'task', badges: [] }],
    },
    timeline: {
      id: asId<NodeId>('timeline'), kind: 'timeline', label: 'Timeline', parentId: asId<NodeId>('inner'),
      interfaceIds: [], typeIds: [], steps: [{ id: 'step', label: 'Step' }],
    },
  },
};

describe('escapeStep', () => {
  it('steps a node out to the group that holds it', () => {
    expect(escapeStep(nested, { kind: 'node', id: 'leaf' })).toEqual({ kind: 'node', id: 'inner' });
  });

  it('keeps stepping outward one group at a time', () => {
    expect(escapeStep(nested, { kind: 'node', id: 'inner' })).toEqual({ kind: 'node', id: 'map' });
  });

  it('clears once the outermost group is reached', () => {
    expect(escapeStep(nested, { kind: 'node', id: 'map' })).toBeNull();
  });

  it('clears anything that is not a node, and stays cleared', () => {
    expect(escapeStep(nested, { kind: 'wire', id: 'wire-a' })).toBeNull();
    expect(escapeStep(nested, { kind: 'interface', id: 'iface-a' })).toBeNull();
    expect(escapeStep(nested, null)).toBeNull();
  });

  it('clears rather than stepping into a parent that no longer exists', () => {
    const orphaned = { ...nested, nodes: { leaf: nested.nodes.leaf } };
    expect(escapeStep(orphaned, { kind: 'node', id: 'leaf' })).toBeNull();
  });
});

describe('selectionResolves', () => {
  it('Component item resolves and expires', () => {
    expect(selectionResolves(nested, null)).toBe(true);
    expect(selectionResolves(nested, { kind: 'node', id: 'leaf' })).toBe(true);
    expect(selectionResolves(nested, { kind: 'component-item', nodeId: 'tree', collection: 'rows', itemId: 'row' })).toBe(true);
    expect(selectionResolves(nested, { kind: 'component-item', nodeId: 'timeline', collection: 'steps', itemId: 'step' })).toBe(true);
    expect(selectionResolves(nested, { kind: 'node', id: 'gone' })).toBe(false);
    expect(selectionResolves(nested, { kind: 'wire', id: 'gone' })).toBe(false);
    expect(selectionResolves(nested, { kind: 'component-item', nodeId: 'gone', collection: 'rows', itemId: 'row' })).toBe(false);
    expect(selectionResolves(nested, { kind: 'component-item', nodeId: 'tree', collection: 'rows', itemId: 'gone' })).toBe(false);
    expect(selectionResolves(nested, { kind: 'component-item', nodeId: 'timeline', collection: 'steps', itemId: 'gone' })).toBe(false);
    expect(selectionResolves(nested, { kind: 'component-item', nodeId: 'tree', collection: 'steps', itemId: 'row' })).toBe(false);
  });
});
