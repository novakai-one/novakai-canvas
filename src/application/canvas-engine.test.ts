import { describe, expect, it, vi } from 'vitest';
import { createCanvasEngine } from './canvas-engine';
import type { ArchitectureDocument } from '../domain/model';
import { emptyArchitecture } from '../domain/defaults';

const initial: ArchitectureDocument = {
  ...structuredClone(emptyArchitecture), id: 'map', name: 'Map',
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
        id: 'node', kind: 'module', label: 'Module', interfaceIds: [], typeIds: [],
      },
      placement: { nodeId: 'node', position: { x: 0, y: 0 }, size: { width: 160, height: 80 }, pinned: false },
    });
    await engine.save();
    expect(listener).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(engine.snapshot());
  });

  it('tracks the persisted revision across edits, saves, and reloads', async () => {
    const fromDisk: ArchitectureDocument = { ...initial, revision: 9 };
    const engine = createCanvasEngine(initial, { load: async () => fromDisk, save: async () => undefined });
    expect(engine.persistedRevision()).toBe(0);

    engine.execute({
      kind: 'node.add',
      node: {
        id: 'node', kind: 'module', label: 'Module', interfaceIds: [], typeIds: [],
      },
      placement: { nodeId: 'node', position: { x: 0, y: 0 }, size: { width: 160, height: 80 }, pinned: false },
    });
    expect(engine.snapshot().revision).toBe(1);
    expect(engine.persistedRevision()).toBe(0);

    await engine.save();
    expect(engine.persistedRevision()).toBe(1);

    const listener = vi.fn();
    engine.subscribe(listener);
    await engine.reload();
    expect(listener).toHaveBeenCalledOnce();
    expect(engine.snapshot()).toEqual(fromDisk);
    expect(engine.persistedRevision()).toBe(9);
  });

  it('undoes one complete command back to the exact prior snapshot', () => {
    const engine = createCanvasEngine(initial, { load: async () => initial, save: async () => undefined });
    engine.execute({
      kind: 'node.add',
      node: { id: 'node', kind: 'module', label: 'Module', interfaceIds: [], typeIds: [] },
      placement: { nodeId: 'node', position: { x: 10, y: 20 }, size: { width: 160, height: 80 }, pinned: false },
    });

    expect(engine.canUndo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect({ ...engine.snapshot(), revision: initial.revision }).toEqual(initial);
    expect(engine.snapshot().revision).toBe(2);
    expect(engine.canUndo()).toBe(false);
  });
});
