import { describe, expect, it, vi } from 'vitest';
import { createCanvasEngine } from './canvas-engine';
import type { ArchitectureDocument } from '../domain/model';

const initial: ArchitectureDocument = {
  schemaVersion: 1, id: 'map', name: 'Map', revision: 0,
  nodes: {}, interfaces: {}, types: {}, wires: {},
};

describe('createCanvasEngine', () => {
  it('publishes changes and saves snapshots', async () => {
    const save = vi.fn(async () => undefined);
    const engine = createCanvasEngine(initial, { load: async () => initial, save });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.execute({
      kind: 'node.add',
      node: {
        id: 'node', kind: 'module', label: 'Module', position: { x: 0, y: 0 },
        size: { width: 160, height: 80 }, interfaceIds: [], typeIds: [],
      },
    });
    await engine.save();
    expect(listener).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(engine.snapshot());
  });
});
