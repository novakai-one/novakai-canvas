import { describe, expect, it } from 'vitest';
import { applyCanvasCommand } from './commands';
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

describe('layout authority', () => {
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
