import { describe, expect, it, vi } from 'vitest';
import { createCanvasEngine } from '@novakai/canvas';
import type { ArchitectureDocument } from '@novakai/canvas';
import { emptyArchitecture } from '@novakai/canvas';

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
    expect({
      ...engine.snapshot(), revision: initial.revision, appliedOperations: initial.appliedOperations,
    }).toEqual(initial);
    expect(engine.snapshot().revision).toBe(2);
    expect(engine.canUndo()).toBe(false);
  });

  it('applies a typed batch atomically and records who authored it', () => {
    const engine = createCanvasEngine(initial, { load: async () => initial, save: async () => undefined });
    const outcome = engine.submit({
      operationId: 'agent-op-1',
      expectedRevision: 0,
      actor: { id: 'agent-claude', kind: 'agent' },
      timestamp: '2026-08-05T12:00:00.000Z',
      provenance: { source: 'cli', sourceRef: 'session-123' },
      commands: [{
        kind: 'node.add',
        node: { id: 'module-a', kind: 'module', label: 'Module A', interfaceIds: [], typeIds: [] },
        placement: { nodeId: 'module-a', position: { x: 10, y: 20 }, size: { width: 160, height: 80 }, pinned: false },
      }, {
        kind: 'node.update', id: 'module-a', patch: { description: 'Added in the same operation' },
      }],
    });

    expect(outcome).toEqual({ status: 'applied', operationId: 'agent-op-1', revision: 1, commandsApplied: 2 });
    expect(engine.snapshot().nodes['module-a'].description).toBe('Added in the same operation');
    expect(engine.snapshot().appliedOperations['agent-op-1']).toMatchObject({
      actor: { id: 'agent-claude', kind: 'agent' },
      provenance: { source: 'cli', sourceRef: 'session-123' },
      revision: 1,
      commandKinds: ['node.add', 'node.update'],
    });
  });

  it('rejects a whole invalid or stale batch and makes duplicate operation IDs safe', () => {
    const engine = createCanvasEngine(initial, { load: async () => initial, save: async () => undefined });
    const valid = {
      operationId: 'agent-op-1', expectedRevision: 0,
      actor: { id: 'agent-codex', kind: 'agent' as const },
      timestamp: '2026-08-05T12:00:00.000Z',
      provenance: { source: 'agent' as const },
      commands: [{
        kind: 'node.add' as const,
        node: { id: 'module-a', kind: 'module' as const, label: 'Module A', interfaceIds: [], typeIds: [] },
        placement: { nodeId: 'module-a', position: { x: 10, y: 20 }, size: { width: 160, height: 80 }, pinned: false },
      }],
    };
    expect(engine.submit(valid).status).toBe('applied');
    expect(engine.submit(valid)).toMatchObject({ status: 'duplicate', originalRevision: 1, revision: 1 });

    expect(engine.submit({ ...valid, operationId: 'stale', commands: [], expectedRevision: 0 })).toEqual({
      status: 'conflict', operationId: 'stale', expectedRevision: 0, actualRevision: 1,
    });

    const before = structuredClone(engine.snapshot());
    const rejected = engine.submit({
      ...valid,
      operationId: 'invalid',
      expectedRevision: 1,
      commands: [
        { kind: 'node.update', id: 'module-a', patch: { label: 'Must roll back' } },
        { kind: 'node.remove', id: 'missing-node' },
      ],
    });
    expect(rejected).toMatchObject({ status: 'rejected', operationId: 'invalid', commandIndex: 1 });
    expect(engine.snapshot()).toEqual(before);
  });

  it('describes the valid vocabulary without an agent reading UI code', () => {
    const engine = createCanvasEngine(initial, { load: async () => initial, save: async () => undefined });
    expect(engine.describe()).toMatchObject({
      schemaVersion: 2,
      revision: 0,
      nodeKinds: expect.arrayContaining(['module', 'scope', 'comment']),
      nodeAliases: { group: 'scope' },
      wireKinds: expect.arrayContaining(['references', 'executes']),
      layoutTargets: ['diagram', 'group', 'nodes'],
      layoutStrategies: ['manual', 'hierarchy'],
    });
  });

  it('does not forget an operation ID when its visual change is undone', () => {
    const engine = createCanvasEngine(initial, { load: async () => initial, save: async () => undefined });
    const changeSet = {
      operationId: 'agent-op-once', expectedRevision: 0,
      actor: { id: 'agent-kimi', kind: 'agent' as const },
      timestamp: '2026-08-05T12:00:00.000Z',
      provenance: { source: 'agent' as const },
      commands: [{
        kind: 'node.add' as const,
        node: { id: 'once', kind: 'module' as const, label: 'Once', interfaceIds: [], typeIds: [] },
        placement: { nodeId: 'once', position: { x: 0, y: 0 }, size: { width: 160, height: 80 }, pinned: false },
      }],
    };
    expect(engine.submit(changeSet).status).toBe('applied');
    expect(engine.undo()).toBe(true);
    expect(engine.snapshot().nodes.once).toBeUndefined();
    expect(engine.submit(changeSet).status).toBe('duplicate');
  });
});
