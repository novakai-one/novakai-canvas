import { describe, expect, it } from 'vitest';
import { parseArchitectureDocument } from '../domain/schema';
import { migrateDocumentToLibrary } from '../domain/migrate/v2-to-v3';
import {
  createCanvasWorkspace, isSignatureName, type ActorContext, type RecordCommand,
} from './canvas-workspace';
import type { DiagramRecord } from '../domain/records';
import working from '../domain/migrate/fixtures/real-v2-working-copy.json' with { type: 'json' };

const human: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui' },
};

function openMessagingScope(): DiagramRecord {
  const library = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  return library.records['messaging-scope'];
}

function batch(commands: RecordCommand[], expectedRevision: number, operationId = 'op-1') {
  return { operationId, expectedRevision, timestamp: '2026-08-06T00:00:00.000Z', commands };
}

describe('canvas workspace', () => {
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
        kind: 'node.resize', id: nodeId, size: { width: 400, height: 300 }, sizeMode: 'manual',
      },
    ], before.revision, 'op-resize'));

    const settled = placementOf(workspace.snapshot());
    expect(settled?.position).toEqual({ x: 50, y: 60 });
    expect(settled?.size).toEqual({ width: 400, height: 300 });
    expect(settled?.sizeMode).toBe('manual');

    workspace.execute({ kind: 'node.autoSize', id: nodeId });
    const automatic = placementOf(workspace.snapshot());
    expect(automatic?.sizeMode).toBe('auto');
    expect(automatic?.size).not.toEqual({ width: 400, height: 300 });

    expect(workspace.undo()).toBe(true);
    expect(placementOf(workspace.snapshot())?.sizeMode).toBe('manual');

    expect(workspace.undo()).toBe(true);

    const after = placementOf(workspace.snapshot());
    expect(after?.position).toEqual(origin.position);
    expect(after?.size).toEqual(origin.size);
  });

  it('takes a removed node\'s wires, geometry, interfaces and types with it', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const record = workspace.snapshot();
    const target = Object.values(record.nodes).find((node) => node.interfaceIds.length > 0);
    if (!target) throw new Error('fixture has no node owning an interface');
    const ownedInterface = target.interfaceIds[0];
    const attachedWires = Object.values(record.wires)
      .filter((wire) => wire.source.nodeId === target.id || wire.target.nodeId === target.id);
    expect(attachedWires.length).toBeGreaterThan(0);

    workspace.submit(batch([{ kind: 'node.remove', id: target.id }], record.revision));

    const after = workspace.snapshot();
    expect(after.nodes[target.id]).toBeUndefined();
    expect(after.interfaces[ownedInterface]).toBeUndefined();
    for (const wire of attachedWires) expect(after.wires[wire.id]).toBeUndefined();
    for (const layout of Object.values(after.layouts)) {
      expect(layout.placements[target.id]).toBeUndefined();
    }
  });

  it('keeps collapsed state in the view and nowhere else', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const record = workspace.snapshot();
    const group = Object.values(record.nodes).find((node) => node.kind === 'group');
    if (!group) throw new Error('fixture has no group');

    workspace.submit(batch([{ kind: 'view.setCollapsed', id: group.id, collapsed: true }], record.revision));

    const after = workspace.snapshot();
    expect(after.views[after.activeViewId].collapsedNodeIds).toContain(group.id);
    expect(JSON.stringify(after.layouts)).not.toContain('collapsed');
  });

  it('refuses to make a group its own ancestor', () => {
    // Needs a group nested inside another group; the real data has 37 of them.
    const library = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
    const found = Object.values(library.records).flatMap((candidate) => {
      const nested = Object.values(candidate.nodes).find((node) => node.kind === 'group'
        && node.parentId !== undefined
        && candidate.nodes[node.parentId]?.kind === 'group');
      return nested?.parentId ? [{ record: candidate, parent: nested.parentId, child: nested.id }] : [];
    })[0];
    if (!found) throw new Error('fixture has no nested group');

    const workspace = createCanvasWorkspace(found.record, human);
    const outcome = workspace.submit(batch([
      { kind: 'node.reparent', id: found.parent, parentId: found.child },
    ], found.record.revision));

    expect(outcome).toMatchObject({ status: 'rejected', reason: 'parent-cycle' });
  });

  it('records who acted from host context, not from the payload', () => {
    const agent: ActorContext = {
      actor: { id: 'codex-1', kind: 'agent' },
      provenance: { source: 'agent' },
    };
    const workspace = createCanvasWorkspace(openMessagingScope(), agent);
    const revision = workspace.snapshot().revision;

    workspace.submit(batch([{ kind: 'diagram.rename', name: 'By agent' }], revision, 'op-actor'));

    expect(workspace.snapshot().appliedOperations['op-actor']).toMatchObject({
      actor: { id: 'codex-1', kind: 'agent' },
      provenance: { source: 'agent' },
    });
  });

  /**
   * A wire's own words are editable, like a node's.
   *
   * The studio could only ever delete a wire because no command existed to change one, which is
   * what made its panel read-only while the node panel was a full editor.
   */
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
