import { describe, expect, it } from 'vitest';
import { human, openMessagingScope, batch, createCanvasWorkspace } from './canvas-workspace-fixture.ts';
import type { DiagramRecord } from './canvas-workspace-fixture.ts';

describe('canvas workspace', () => {
  it('activates only a declared flow and leaves its basemap unchanged', () => {
    const record = openMessagingScope();
    const ref = Object.keys(record.wires)[0];
    record.flows = { delivery: { id: 'delivery' as never, name: 'Delivery', steps: [{ ref: ref as never, ordinal: 1 }] } };
    const workspace = createCanvasWorkspace(record, human);
    const basemap = JSON.stringify([record.nodes, record.wires, record.layouts]);
    expect(workspace.execute({ kind: 'flow.activate', flowId: 'delivery' as never }).status).toBe('applied');
    expect(workspace.snapshot().views[record.activeViewId].flowId).toBe('delivery');
    expect(JSON.stringify([workspace.snapshot().nodes, workspace.snapshot().wires, workspace.snapshot().layouts])).toBe(basemap);
    const activated = workspace.snapshot();
    expect(workspace.execute({ kind: 'flow.activate', flowId: 'missing' as never })).toMatchObject({ status: 'rejected' });
    expect(workspace.snapshot()).toBe(activated);
  });

  it('applies a batch as one revision', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const before = workspace.snapshot().revision;

    const outcome = workspace.submit(batch([
      { kind: 'diagram.rename', name: 'Agent Messaging v2' },
      { kind: 'view.setViewport', viewport: { x: 10, y: 20, zoom: 1.5 } },
    ], before));

    expect(outcome).toMatchObject({ status: 'applied', commandsApplied: 2 });
    expect(workspace.snapshot().revision).toBe(before + 1);
    expect(workspace.snapshot().name).toBe('Agent Messaging v2');
  });

  it('mutates nothing when any command in a batch fails', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const before = structuredClone(workspace.snapshot());

    const outcome = workspace.submit(batch([
      { kind: 'diagram.rename', name: 'Half applied' },
      { kind: 'node.remove', id: 'does-not-exist' },
    ], before.revision));

    expect(outcome).toMatchObject({ status: 'rejected', commandIndex: 1 });
    expect(workspace.snapshot()).toEqual(before);
  });

  it('reports a stale expectation as a conflict instead of overwriting', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const revision = workspace.snapshot().revision;
    workspace.submit(batch([{ kind: 'diagram.rename', name: 'First' }], revision, 'op-a'));

    const outcome = workspace.submit(batch([{ kind: 'diagram.rename', name: 'Second' }], revision, 'op-b'));

    expect(outcome).toMatchObject({ status: 'conflict', actualRevision: revision + 1 });
    expect(workspace.snapshot().name).toBe('First');
  });

  it('recognises a replayed operation instead of applying it twice', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const revision = workspace.snapshot().revision;
    const replayed = batch([{ kind: 'diagram.rename', name: 'Once' }], revision, 'op-replay');

    expect(workspace.submit(replayed)).toMatchObject({ status: 'applied' });
    expect(workspace.submit(replayed)).toMatchObject({ status: 'duplicate' });
    expect(workspace.snapshot().revision).toBe(revision + 1);
  });

  it('restores content exactly on undo while the operation ledger only grows', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const before = structuredClone(workspace.snapshot());

    workspace.submit(batch([{ kind: 'diagram.rename', name: 'Renamed' }], before.revision, 'op-undo'));
    expect(workspace.undo()).toBe(true);

    const after = workspace.snapshot();
    expect(after.name).toBe(before.name);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.wires).toEqual(before.wires);
    expect(after.layouts).toEqual(before.layouts);
    expect(after.views).toEqual(before.views);
    // The ledger is deliberately not restored: forgetting an operation ID would let a replay
    // of it apply a second time.
    expect(after.appliedOperations['op-undo']).toBeDefined();
  });

  it('undoes a move+resize batch as one gesture', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const before = workspace.snapshot();
    const nodeId = Object.values(before.nodes).find((node) => node.kind !== 'group')?.id as string;
    // Placements live per layout; read the one layout that holds this node.
    const placementOf = (record: DiagramRecord) => Object.values(record.layouts)
      .map((layout) => layout.placements[nodeId])
      .find((placement) => placement !== undefined);
    const origin = placementOf(before);
    if (!origin) throw new Error('fixture node has no placement');

    workspace.submit(batch([
      { kind: 'node.move', id: nodeId, position: { x: 50, y: 60 } },
      {
        kind: 'node.resize', id: nodeId, size: { width: 160, height: 80 }, sizeMode: 'manual',
      },
    ], before.revision, 'op-resize'));

    const settled = placementOf(workspace.snapshot());
    expect(settled?.position).toEqual({ x: 50, y: 60 });
    expect(settled?.size.width).toBe(160);
    expect(settled?.size.height).toBeGreaterThanOrEqual(80);
    expect(settled?.sizeMode).toBe('manual');

    workspace.execute({ kind: 'node.autoSize', id: nodeId });
    const automatic = placementOf(workspace.snapshot());
    expect(automatic?.sizeMode).toBe('auto');
    expect(automatic?.size).not.toEqual({ width: 160, height: 80 });

    expect(workspace.undo()).toBe(true);
    expect(placementOf(workspace.snapshot())?.sizeMode).toBe('manual');

    expect(workspace.undo()).toBe(true);

    const after = placementOf(workspace.snapshot());
    expect(after?.position).toEqual(origin.position);
    expect(after?.size).toEqual(origin.size);
  });

});
