import { describe, expect, it } from 'vitest';
import { human, openMessagingScope, batch, createCanvasWorkspace } from './canvas-workspace-fixture.ts';
import type { DiagramRecord } from './canvas-workspace-fixture.ts';

/** `./canvas apply` delivers definition dictionaries after the nodes that use them, in one batch. */
function definitionsFor(record: DiagramRecord, ownerId: string) {
  return {
    interfaces: {
      ...record.interfaces,
      'send-iface': {
        id: 'send-iface', ownerId, name: 'send', accepts: ['Message'], returns: ['Receipt'],
      },
    },
    types: {
      ...record.types,
      'message-type': { id: 'message-type', name: 'Message', fields: ['id', 'body'] },
    },
  };
}

describe('definition batches', () => {
  it('rejects a batch whose completed record has a dangling definition', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const before = structuredClone(workspace.snapshot());

    const outcome = workspace.submit(batch([{
      kind: 'node.add',
      node: {
        id: 'invalid-module', kind: 'module', label: 'Invalid',
        interfaceIds: ['missing-interface'], typeIds: [],
      },
      placement: { position: { x: 0, y: 0 }, size: { width: 200, height: 100 } },
    } as never], before.revision));

    expect(outcome).toMatchObject({ status: 'rejected' });
    expect(workspace.snapshot()).toEqual(before);
  });

  it('sizes a node whose definitions arrive later in the same batch as if they came first', () => {
    const record = openMessagingScope();
    const sizeOf = (snapshot: DiagramRecord) =>
      snapshot.layouts[snapshot.views[snapshot.activeViewId].layoutId].placements['defs-late'].size;

    const workspace = createCanvasWorkspace(record, human);
    const outcome = workspace.submit(batch([
      {
        kind: 'node.add',
        node: {
          id: 'defs-late', kind: 'module', label: 'Send service',
          interfaceIds: ['send-iface'], typeIds: ['message-type'],
        },
        placement: { position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, sizeMode: 'auto' },
      } as never,
      { kind: 'diagram.definitions.replace', ...definitionsFor(record, 'defs-late') } as never,
    ], workspace.snapshot().revision));
    expect(outcome).toMatchObject({ status: 'applied' });
    const sizedByBatch = sizeOf(workspace.snapshot());

    // The batch must leave the node at its content-measured size: re-measuring is a no-op.
    expect(workspace.execute({ kind: 'node.autoSize', id: 'defs-late' } as never).status).toBe('applied');
    expect(sizedByBatch).toEqual(sizeOf(workspace.snapshot()));
  });

  it('applies an arranged child whose definitions arrive later in the same batch', () => {
    const record = openMessagingScope();
    const workspace = createCanvasWorkspace(record, human);
    const setup = workspace.submit(batch([
      {
        kind: 'node.add',
        node: { id: 'stack-zone', kind: 'group', label: 'Zone', interfaceIds: [], typeIds: [] },
        placement: { position: { x: 0, y: 0 }, size: { width: 400, height: 300 } },
      } as never,
      {
        kind: 'layout.arrangement.set', id: 'stack-zone',
        arrangement: { layout: 'stack', gap: 16, align: 'stretch' },
      } as never,
    ], workspace.snapshot().revision, 'op-setup'));
    expect(setup).toMatchObject({ status: 'applied' });

    const outcome = workspace.submit(batch([
      {
        kind: 'node.add',
        node: {
          id: 'arranged-child', kind: 'module', label: 'Send service',
          parentId: 'stack-zone', interfaceIds: ['send-iface'], typeIds: ['message-type'],
        },
        placement: { position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, sizeMode: 'auto' },
      } as never,
      { kind: 'diagram.definitions.replace', ...definitionsFor(record, 'arranged-child') } as never,
    ], workspace.snapshot().revision, 'op-child'));

    expect(outcome).toMatchObject({ status: 'applied' });
    expect(workspace.snapshot().nodes['arranged-child']).toBeDefined();
  });
});
