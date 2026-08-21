import { describe, expect, it } from 'vitest';
import { applyCanvasCommand } from './commands';
import { layoutScopes } from './diagram-geometry';
import { parseArchitectureDocument } from './schema';

function legacyDocument() {
  return parseArchitectureDocument({
    schemaVersion: 1,
    id: 'diagram-one',
    name: 'Diagram one',
    revision: 2,
    nodes: {
      module: {
        id: 'module', kind: 'module', label: 'Module',
        position: { x: 10, y: 20 }, size: { width: 200, height: 100 },
        interfaceIds: [], typeIds: [],
      },
    },
    interfaces: {}, types: {}, wires: {},
  });
}

function arrangedStack(connected: boolean) {
  return parseArchitectureDocument({
    schemaVersion: 2,
    id: 'stack',
    name: 'Stack',
    revision: 0,
    nodes: {
      stack: { id: 'stack', kind: 'scope', label: 'Stack', interfaceIds: [], typeIds: [] },
      one: { id: 'one', kind: 'module', label: 'One', parentId: 'stack', interfaceIds: [], typeIds: [] },
      two: { id: 'two', kind: 'module', label: 'Two', parentId: 'stack', interfaceIds: [], typeIds: [] },
    },
    interfaces: {},
    types: {},
    wires: connected ? {
      flow: { id: 'flow', source: 'one', target: 'two', label: 'flows', kind: 'executes', routing: 'elbow' },
    } : {},
    activeLayoutId: 'layout-default',
    layouts: {
      'layout-default': {
        id: 'layout-default',
        name: 'Default',
        strategy: 'hierarchy',
        placements: Object.fromEntries(['stack', 'one', 'two'].map((nodeId) => [nodeId, {
          nodeId, position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, pinned: false,
        }])),
        wireRouteHints: {},
        collapsedNodeIds: [],
        arrangementByContainerId: {
          stack: { layout: 'stack', gap: 8, align: 'stretch', childIds: ['one', 'two'] },
        },
      },
    },
    diagrams: {},
    appliedOperations: {},
  });
}

function verticalGap(document: ReturnType<typeof arrangedStack>): number {
  const placements = document.layouts['layout-default'].placements;
  return placements.two.position.y - placements.one.position.y - placements.one.size.height;
}

describe('layout authority', () => {
  it('uses authored gap exactly until a wire requires more room, without moving a pin', () => {
    const unconnected = layoutScopes(arrangedStack(false), ['stack']);
    const connected = layoutScopes(arrangedStack(true), ['stack']);
    expect(verticalGap(unconnected)).toBe(8);
    expect(verticalGap(connected)).toBe(72);

    connected.layouts['layout-default'].placements.two = {
      ...connected.layouts['layout-default'].placements.two,
      position: { x: 400, y: 300 },
      pinned: true,
    };
    const pinned = layoutScopes(connected, ['stack']);
    expect(pinned.layouts['layout-default'].placements.two.position).toEqual({ x: 400, y: 300 });
  });

  it('moves geometry in the active layout without mutating semantic node meaning', () => {
    const document = legacyDocument();
    const next = applyCanvasCommand(document, {
      kind: 'node.move', id: 'module', position: { x: 400, y: 500 },
    });

    expect(next.nodes.module).toEqual(document.nodes.module);
    expect(next.layouts['layout-default'].placements.module.position).toEqual({ x: 400, y: 500 });
    expect(next.revision).toBe(3);
  });

  it('removes a node placement from every saved layout with the node', () => {
    const document = legacyDocument();
    document.layouts.copy = {
      ...structuredClone(document.layouts['layout-default']),
      id: 'copy',
      name: 'Copy',
    };

    const next = applyCanvasCommand(document, { kind: 'node.remove', id: 'module' });

    expect(next.nodes.module).toBeUndefined();
    expect(next.layouts['layout-default'].placements.module).toBeUndefined();
    expect(next.layouts.copy.placements.module).toBeUndefined();
  });

  it('pins a node in one layout without changing semantic meaning', () => {
    const document = legacyDocument();
    const next = applyCanvasCommand(document, { kind: 'node.pin', id: 'module', pinned: true });

    expect(next.nodes.module).toEqual(document.nodes.module);
    expect(next.layouts['layout-default'].placements.module.pinned).toBe(true);
  });
});
