import { describe, expect, it } from 'vitest';
import { applyCanvasCommand } from './commands';
import type { ArchitectureDocument } from './model';
import { placementFor } from './layouts';
import { parseArchitectureDocument } from './schema';

const document: ArchitectureDocument = parseArchitectureDocument({
  schemaVersion: 1, id: 'map', name: 'Map', revision: 0,
  nodes: { one: {
    id: 'one', kind: 'module', label: 'One', position: { x: 0, y: 0 },
    size: { width: 100, height: 60 }, interfaceIds: [], typeIds: [],
  } },
  interfaces: {}, types: {}, wires: {},
});

describe('applyCanvasCommand', () => {
  it('moves a node immutably', () => {
    const next = applyCanvasCommand(document, { kind: 'node.move', id: 'one', position: { x: 20, y: 30 } });
    expect(placementFor(next, 'one').position).toEqual({ x: 20, y: 30 });
    expect(placementFor(document, 'one').position).toEqual({ x: 0, y: 0 });
    expect(next.revision).toBe(1);
  });

  it('resizes a node immutably', () => {
    const next = applyCanvasCommand(document, { kind: 'node.resize', id: 'one', size: { width: 320, height: 180 } });
    expect(placementFor(next, 'one').size).toEqual({ width: 320, height: 180 });
    expect(placementFor(document, 'one').size).toEqual({ width: 100, height: 60 });
    expect(next.revision).toBe(1);
  });

  it('removes incident wires with a node', () => {
    const wired = structuredClone(document);
    wired.nodes.two = { ...wired.nodes.one, id: 'two', label: 'Two' };
    wired.layouts['layout-default'].placements.two = {
      ...wired.layouts['layout-default'].placements.one, nodeId: 'two',
    };
    wired.wires.link = { id: 'link', source: 'one', target: 'two', label: '', kind: 'owns', routing: 'elbow' };
    const next = applyCanvasCommand(wired, { kind: 'node.remove', id: 'one' });
    expect(next.nodes.one).toBeUndefined();
    expect(next.wires.link).toBeUndefined();
  });

  it('reconnects an existing wire without replacing its identity', () => {
    const wired = structuredClone(document);
    wired.nodes.two = { ...wired.nodes.one, id: 'two', label: 'Two' };
    wired.nodes.three = { ...wired.nodes.one, id: 'three', label: 'Three' };
    wired.wires.link = { id: 'link', source: 'one', target: 'two', label: 'calls', kind: 'executes', routing: 'elbow' };

    const next = applyCanvasCommand(wired, {
      kind: 'wire.reconnect', id: 'link', source: 'one', target: 'three',
    });

    expect(next.wires.link).toEqual({
      id: 'link', source: 'one', target: 'three', label: 'calls', kind: 'executes', routing: 'elbow',
    });
  });

  it('lays out one scope without moving another scope', () => {
    const scoped = structuredClone(document);
    scoped.nodes.one = { ...scoped.nodes.one, kind: 'scope' };
    scoped.layouts['layout-default'].placements.one.size = { width: 400, height: 300 };
    scoped.nodes.child = {
      ...scoped.nodes.one,
      id: 'child',
      kind: 'module',
      parentId: 'one',
    };
    scoped.layouts['layout-default'].placements.child = {
      nodeId: 'child', position: { x: 0, y: 0 }, size: { width: 180, height: 90 }, pinned: false,
    };
    scoped.nodes.other = {
      ...scoped.nodes.one,
      id: 'other',
    };
    scoped.layouts['layout-default'].placements.other = {
      nodeId: 'other', position: { x: 900, y: 700 }, size: { width: 400, height: 300 }, pinned: false,
    };
    const next = applyCanvasCommand(scoped, { kind: 'scope.layout', id: 'one' });
    expect(placementFor(next, 'one').position).toEqual(placementFor(scoped, 'one').position);
    expect(placementFor(next, 'child').position).not.toEqual(placementFor(scoped, 'child').position);
    expect(next.nodes.other).toEqual(scoped.nodes.other);
    expect(placementFor(next, 'other')).toEqual(placementFor(scoped, 'other'));
    expect(next.revision).toBe(scoped.revision + 1);
  });
});
