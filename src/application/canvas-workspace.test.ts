import { describe, expect, it } from 'vitest';
import { parseArchitectureDocument } from '../domain/schema';
import { migrateDocumentToLibrary } from '../domain/migrate/v2-to-v3';
import { createCanvasWorkspace, type ActorContext, type RecordCommand } from './canvas-workspace';
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
      [{ kind: 'wire.update', id, patch: { label: 'renamed', kind: 'queries' } }],
      before.revision,
      'op-wire-update',
    ));

    expect(outcome.status).toBe('applied');
    const after = workspace.snapshot().wires[id];
    expect(after).toMatchObject({ label: 'renamed', kind: 'queries' });
    expect(after.source).toEqual(original.source);
    expect(after.target).toEqual(original.target);
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
});
