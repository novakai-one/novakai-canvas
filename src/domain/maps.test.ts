import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from './model';
import { placementFor } from './layouts';
import { parseArchitectureDocument } from './schema';
import {
  focusArchitecture, linkedArchitectureMap, listArchitectureMaps, presentArchitecture, resolveArchitectureMap,
} from './maps';

function node(id: string, parentId?: string) {
  return {
    id,
    kind: parentId ? 'module' : 'scope',
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    ...(parentId ? { parentId } : {}),
    interfaceIds: id === 'a-child' ? ['a-interface'] : [],
    typeIds: id === 'a-child' ? ['a-type'] : [],
  };
}

const document: ArchitectureDocument = parseArchitectureDocument({
  schemaVersion: 1,
  id: 'architecture',
  name: 'Architecture',
  revision: 4,
  nodes: {
    a: node('a'),
    'a-child': node('a-child', 'a'),
    'a-grandchild': node('a-grandchild', 'a-child'),
    b: node('b'),
    'b-child': node('b-child', 'b'),
  },
  interfaces: {
    'a-interface': { id: 'a-interface', ownerId: 'a-child', name: 'read', accepts: [], returns: ['A'] },
    'b-interface': { id: 'b-interface', ownerId: 'b-child', name: 'read', accepts: [], returns: ['B'] },
  },
  types: {
    'a-type': { id: 'a-type', name: 'A', fields: ['id'] },
    'b-type': { id: 'b-type', name: 'B', fields: ['id'] },
  },
  wires: {
    'a-wire': { id: 'a-wire', source: 'a-child', target: 'a-grandchild', label: 'inside', kind: 'owns', routing: 'elbow' },
    'cross-wire': { id: 'cross-wire', source: 'a-child', target: 'b-child', label: 'outside', kind: 'references', routing: 'elbow' },
  },
});

describe('architecture maps', () => {
  it('lists only top-level scopes in document order', () => {
    expect(listArchitectureMaps(document)).toEqual([
      { id: 'a', rootNodeId: 'a', label: 'a', status: 'active' },
      { id: 'b', rootNodeId: 'b', label: 'b', status: 'active' },
    ]);
  });

  it('hides archived diagrams by default and resolves explicit detail links', () => {
    const organised = structuredClone(document);
    organised.diagrams.b.status = 'archived';
    organised.nodes['a-child'].expandsToDiagramId = 'b';
    expect(listArchitectureMaps(organised)).toEqual([{ id: 'a', rootNodeId: 'a', label: 'a', status: 'active' }]);
    expect(listArchitectureMaps(organised, true)).toHaveLength(2);
    expect(linkedArchitectureMap(organised, 'a-child')).toBeUndefined();
    organised.diagrams.b.status = 'active';
    expect(linkedArchitectureMap(organised, 'a-child')).toBe('b');
  });

  it('collapses only one group in the active layout', () => {
    const collapsed = structuredClone(document);
    collapsed.nodes.group = { ...node('group', 'a'), kind: 'scope' };
    collapsed.nodes['group-child'] = { ...node('group-child', 'group'), kind: 'module' };
    collapsed.layouts['layout-default'].placements.group = {
      nodeId: 'group', position: { x: 10, y: 10 }, size: { width: 300, height: 200 }, pinned: false,
    };
    collapsed.layouts['layout-default'].placements['group-child'] = {
      nodeId: 'group-child', position: { x: 30, y: 30 }, size: { width: 100, height: 60 }, pinned: false,
    };
    collapsed.layouts['layout-default'].collapsedNodeIds = ['group'];
    const focused = focusArchitecture(collapsed, 'a');
    expect(focused.nodes.group).toBeDefined();
    expect(focused.nodes['group-child']).toBeUndefined();
    expect(focused.nodes['a-child']).toBeDefined();
  });

  it('keeps a valid choice and falls back to the first map', () => {
    expect(resolveArchitectureMap(document, 'b')).toBe('b');
    expect(resolveArchitectureMap(document, 'missing')).toBe('a');
  });

  it('projects one complete map without leaking other-map facts', () => {
    const focused = focusArchitecture(document, 'a');
    expect(Object.keys(focused.nodes)).toEqual(['a', 'a-child', 'a-grandchild']);
    expect(Object.keys(focused.wires)).toEqual(['a-wire']);
    expect(Object.keys(focused.interfaces)).toEqual(['a-interface']);
    expect(Object.keys(focused.types)).toEqual(['a-type']);
    expect(focused.revision).toBe(document.revision);
  });

  it('presents the same saved layout without mutating stored coordinates', () => {
    const before = structuredClone(document);
    const presented = presentArchitecture(document, 'a');
    expect(placementFor(presented, 'a-child')).toEqual(placementFor(document, 'a-child'));
    expect(presented.revision).toBe(document.revision);
    expect(document).toEqual(before);
  });
});
