import { describe, expect, it } from 'vitest';
import { applyCanvasCommand } from './commands';
import type { ArchitectureDocument } from './model';

const document: ArchitectureDocument = {
  schemaVersion: 1, id: 'map', name: 'Map', revision: 0,
  nodes: { one: {
    id: 'one', kind: 'module', label: 'One', position: { x: 0, y: 0 },
    size: { width: 100, height: 60 }, interfaceIds: [], typeIds: [],
  } },
  interfaces: {}, types: {}, wires: {},
};

describe('applyCanvasCommand', () => {
  it('moves a node immutably', () => {
    const next = applyCanvasCommand(document, { kind: 'node.move', id: 'one', position: { x: 20, y: 30 } });
    expect(next.nodes.one.position).toEqual({ x: 20, y: 30 });
    expect(document.nodes.one.position).toEqual({ x: 0, y: 0 });
    expect(next.revision).toBe(1);
  });

  it('resizes a node immutably', () => {
    const next = applyCanvasCommand(document, { kind: 'node.resize', id: 'one', size: { width: 320, height: 180 } });
    expect(next.nodes.one.size).toEqual({ width: 320, height: 180 });
    expect(document.nodes.one.size).toEqual({ width: 100, height: 60 });
    expect(next.revision).toBe(1);
  });

  it('removes incident wires with a node', () => {
    const wired = structuredClone(document);
    wired.nodes.two = { ...wired.nodes.one, id: 'two', label: 'Two' };
    wired.wires.link = { id: 'link', source: 'one', target: 'two', label: '', kind: 'owns', routing: 'elbow' };
    const next = applyCanvasCommand(wired, { kind: 'node.remove', id: 'one' });
    expect(next.nodes.one).toBeUndefined();
    expect(next.wires.link).toBeUndefined();
  });

  it('lays out one scope without moving another scope', () => {
    const scoped = structuredClone(document);
    scoped.nodes.one = { ...scoped.nodes.one, kind: 'scope', size: { width: 400, height: 300 } };
    scoped.nodes.child = {
      ...scoped.nodes.one,
      id: 'child',
      kind: 'module',
      parentId: 'one',
      size: { width: 180, height: 90 },
    };
    scoped.nodes.other = {
      ...scoped.nodes.one,
      id: 'other',
      position: { x: 900, y: 700 },
    };
    const next = applyCanvasCommand(scoped, { kind: 'scope.layout', id: 'one' });
    expect(next.nodes.one.position).toEqual(scoped.nodes.one.position);
    expect(next.nodes.child.position).not.toEqual(scoped.nodes.child.position);
    expect(next.nodes.other).toEqual(scoped.nodes.other);
    expect(next.revision).toBe(scoped.revision + 1);
  });
});
