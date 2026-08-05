import { describe, expect, it } from 'vitest';
import { asId } from '../domain/id-cast';
import type { NodeId } from '../domain/ids';
import type { DiagramRecord } from '../domain/records';
import {
  createCanvasNode, escapeStep, rootGroupId, selectionResolves,
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
  it('accepts an empty selection and one that names a live node', () => {
    expect(selectionResolves(nested, null)).toBe(true);
    expect(selectionResolves(nested, { kind: 'node', id: 'leaf' })).toBe(true);
  });

  it('rejects a selection left pointing at something undo removed', () => {
    expect(selectionResolves(nested, { kind: 'node', id: 'gone' })).toBe(false);
    expect(selectionResolves(nested, { kind: 'wire', id: 'gone' })).toBe(false);
    expect(selectionResolves(nested, { kind: 'tree-row', nodeId: 'gone', rowId: 'row' })).toBe(false);
  });
});
