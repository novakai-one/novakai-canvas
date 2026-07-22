import { describe, expect, it } from 'vitest';
import type { CanvasNode } from '../domain/model';
import { scopeDepth, sortParentFirst } from './projection';

function scope(id: string, parentId?: string): CanvasNode {
  return {
    id,
    kind: 'scope',
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 320, height: 160 },
    parentId,
    interfaceIds: [],
    typeIds: [],
  };
}

describe('scopeDepth', () => {
  it('walks the parent chain and stops on missing parents and cycles', () => {
    const nodes = {
      map: scope('map'),
      zone: scope('zone', 'map'),
      inner: scope('inner', 'zone'),
      orphan: scope('orphan', 'gone'),
      'cycle-a': scope('cycle-a', 'cycle-b'),
      'cycle-b': scope('cycle-b', 'cycle-a'),
    };
    expect(scopeDepth(nodes, nodes.map)).toBe(0);
    expect(scopeDepth(nodes, nodes.zone)).toBe(1);
    expect(scopeDepth(nodes, nodes.inner)).toBe(2);
    expect(scopeDepth(nodes, nodes.orphan)).toBe(0);
    expect(scopeDepth(nodes, nodes['cycle-a'])).toBe(1);
  });
});

describe('sortParentFirst', () => {
  it('orders every node after its parent chain, stable within a depth', () => {
    const nodes = {
      inner: scope('inner', 'zone'),
      map: scope('map'),
      zone: scope('zone', 'map'),
      sibling: scope('sibling', 'map'),
    };
    expect(sortParentFirst(nodes).map((node) => node.id))
      .toEqual(['map', 'zone', 'sibling', 'inner']);
  });
});
