import { describe, expect, it } from 'vitest';
import { human, openMessagingScope, batch, createCanvasWorkspace, isSignatureName } from './canvas-workspace-fixture.ts';
import type { RecordCommand } from './canvas-workspace-fixture.ts';

describe('canvas workspace', () => {
  it('rewrites a wire label and kind without touching its ends', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const before = workspace.snapshot();
    const [id, original] = Object.entries(before.wires)[0];

    const outcome = workspace.submit(batch(
      [
        { kind: 'wire.update', id, patch: { label: 'renamed', kind: 'queries' } },
        { kind: 'wire.setCardinality', id, source: 'one', target: 'zero-or-many' },
      ],
      before.revision,
      'op-wire-update',
    ));

    expect(outcome.status).toBe('applied');
    expect(workspace.snapshot().wires[id]).toMatchObject({
      label: 'renamed', kind: 'queries',
      source: { nodeId: original.source.nodeId, cardinality: 'one' },
      target: { nodeId: original.target.nodeId, cardinality: 'zero-or-many' },
    });
    const after = workspace.snapshot().wires[id];
    expect(after).toMatchObject({ label: 'renamed', kind: 'queries' });
    expect(after.source.nodeId).toBe(original.source.nodeId);
    expect(after.target.nodeId).toBe(original.target.nodeId);
  });

  it('refuses to update a wire that is not there', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const outcome = workspace.submit(batch(
      [{ kind: 'wire.update', id: 'no-such-wire', patch: { label: 'x' } }],
      workspace.snapshot().revision,
      'op-wire-missing',
    ));

    expect(outcome).toMatchObject({ status: 'rejected', reason: 'wire-not-found:no-such-wire' });
  });

  it('renames an interface and refuses to blank its name', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const id = Object.keys(workspace.snapshot().interfaces)[0];

    const renamed = workspace.submit(batch(
      [{ kind: 'interface.update', id, patch: { name: 'renamedCall' } }],
      workspace.snapshot().revision,
      'op-iface-rename',
    ));
    expect(renamed.status).toBe('applied');
    expect(workspace.snapshot().interfaces[id].name).toBe('renamedCall');

    const blanked = workspace.submit(batch(
      [{ kind: 'interface.update', id, patch: { name: '  ' } }],
      workspace.snapshot().revision,
      'op-iface-blank',
    ));
    expect(blanked).toMatchObject({ status: 'rejected', reason: 'interface-name-empty' });
  });

  /** Undo is only trustworthy if it restores content exactly, including a wire's words. */
  it('restores a wire edit on undo', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const [id, original] = Object.entries(workspace.snapshot().wires)[0];

    workspace.submit(batch(
      [{ kind: 'wire.update', id, patch: { label: 'temporary' } }],
      workspace.snapshot().revision,
      'op-wire-undo',
    ));
    expect(workspace.snapshot().wires[id].label).toBe('temporary');

    expect(workspace.undo()).toBe(true);
    expect(workspace.snapshot().wires[id].label).toBe(original.label);
  });

  /**
   * Chris asked that a node's body "conform to typescript or some standard so people don't write
   * random stuff". The standard is an identifier, and it belongs to the record, not to a form.
   */
  it('refuses a signature that is prose rather than types', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const id = Object.keys(workspace.snapshot().interfaces)[0];

    const outcome = workspace.submit(batch(
      [{ kind: 'interface.update', id, patch: { accepts: ['a thing the user typed'] } }],
      workspace.snapshot().revision,
      'op-prose',
    ));

    expect(outcome).toMatchObject({ status: 'rejected' });
    expect((outcome as { reason: string }).reason).toContain('accepts-not-a-type');
  });

  it('accepts the shapes real signatures actually use', () => {
    expect(['acquire', 'AgentId', 'Frame[]', 'Map<string, Frame>', '$ref', '_private']
      .every(isSignatureName)).toBe(true);
    expect(['', 'two words', '1st', 'has-dash', 'semi;colon'].some(isSignatureName)).toBe(false);
  });

  it('gives a node an interface and takes the reference away again with it', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const ownerId = Object.keys(workspace.snapshot().nodes)[1];
    const before = workspace.snapshot().nodes[ownerId].interfaceIds.length;

    const added = workspace.submit(batch([{
      kind: 'interface.add',
      ownerId,
      iface: { id: 'iface-new', ownerId, name: 'newCall', accepts: [], returns: [] },
    } as RecordCommand], workspace.snapshot().revision, 'op-iface-add'));
    expect(added.status).toBe('applied');
    expect(workspace.snapshot().nodes[ownerId].interfaceIds).toHaveLength(before + 1);

    workspace.submit(batch(
      [{ kind: 'interface.remove', id: 'iface-new' }],
      workspace.snapshot().revision,
      'op-iface-remove',
    ));
    expect(workspace.snapshot().interfaces['iface-new']).toBeUndefined();
    expect(workspace.snapshot().nodes[ownerId].interfaceIds).toHaveLength(before);
  });
});
