import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument, CanvasNode } from './model';
import {
  focusArchitecture, listArchitectureMaps, presentArchitecture, resolveArchitectureMap,
} from './maps';

function node(id: string, parentId?: string): CanvasNode {
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

const document: ArchitectureDocument = {
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
};

describe('architecture maps', () => {
  it('lists only top-level scopes in document order', () => {
    expect(listArchitectureMaps(document)).toEqual([
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b' },
    ]);
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

  it('presents an auto-laid-out copy without mutating stored coordinates', () => {
    const before = structuredClone(document);
    const presented = presentArchitecture(document, 'a');
    expect(presented.nodes['a-child'].position).not.toEqual(document.nodes['a-child'].position);
    expect(presented.revision).toBe(document.revision);
    expect(document).toEqual(before);
  });
});
