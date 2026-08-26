import { describe, expect, it } from 'vitest';
import {
  batch,
  createCanvasWorkspace,
  human,
  migrateDocumentToLibrary,
  openMessagingScope,
  parseArchitectureDocument,
  working,
} from './canvas-workspace-fixture.ts';
import type { ActorContext } from './canvas-workspace-fixture.ts';

describe('canvas workspace', () => {
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

  it('reparents one node without rearranging its former siblings', () => {
    const record = structuredClone(openMessagingScope());
    const group = record.nodes['messaging-scope'];
    const childIds = Object.values(record.nodes)
      .filter((node) => node.parentId === group.id)
      .map((node) => node.id as string);
    const layout = record.layouts[record.views[record.activeViewId].layoutId];
    layout.arrangementByContainerId ??= {};
    layout.arrangementByContainerId[group.id] = {
      layout: 'grid', childIds, gap: 32, align: 'stretch', columns: 3,
    };
    const movedId = childIds[1];
    const siblingPositions = Object.fromEntries(childIds
      .filter((id) => id !== movedId)
      .map((id) => [id, structuredClone(layout.placements[id].position)]));
    const workspace = createCanvasWorkspace(record, human);

    workspace.submit(batch([
      { kind: 'node.reparent', id: movedId },
      { kind: 'node.move', id: movedId, position: { x: 1_200, y: 400 } },
    ], record.revision, 'op-reparent'));

    const after = workspace.snapshot().layouts[layout.id];
    expect(after.placements[movedId].position).toEqual({ x: 1_200, y: 400 });
    expect(Object.fromEntries(Object.keys(siblingPositions)
      .map((id) => [id, after.placements[id].position]))).toEqual(siblingPositions);
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
});
