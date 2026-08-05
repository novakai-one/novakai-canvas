import { describe, expect, it } from 'vitest';
import type { NodeId, ViewId } from './ids';
import { projectView } from './project-view';
import { diagramRecordSchema } from './record-schema';
import type { CanvasView, DiagramRecord, NodeKind } from './records';

/**
 * The real migrated records, read straight from `public/data/diagrams/`.
 *
 * Driving the projection from invented fixtures would only prove it agrees with the shapes the
 * test author imagined. These are the diagrams the app actually opens.
 */
const records: Array<[string, DiagramRecord]> = Object.entries(
  import.meta.glob('../../public/data/diagrams/*.json', {
    query: '?raw', import: 'default', eager: true,
  }) as Record<string, string>,
)
  .map(([path, raw]): [string, DiagramRecord] => [
    path.slice(path.lastIndexOf('/') + 1),
    diagramRecordSchema.parse(JSON.parse(raw)),
  ])
  .sort(([left], [right]) => left.localeCompare(right));

function withActiveView(record: DiagramRecord, patch: Partial<CanvasView>): DiagramRecord {
  const view = record.views[record.activeViewId];
  return {
    ...record,
    views: { ...record.views, [record.activeViewId]: { ...view, ...patch } },
  };
}

function containedNodeIds(record: DiagramRecord, containerId: string): string[] {
  const inside: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(record.nodes)) {
      if (!node.parentId || inside.includes(node.id)) continue;
      if (node.parentId === containerId || inside.includes(node.parentId)) {
        inside.push(node.id);
        changed = true;
      }
    }
  }
  return inside.sort();
}

describe('projected view', () => {
  it.each(records)('%s: gives every visible node the geometry of the active layout', (_name, record) => {
    const view = record.views[record.activeViewId];
    const layout = record.layouts[view.layoutId];
    const projected = projectView(record);

    expect(projected.nodes.length).toBeGreaterThan(0);
    for (const node of projected.nodes) {
      const placement = layout.placements[node.id];
      expect(placement).toBeDefined();
      expect(node.position).toEqual(placement.position);
      expect(node.size).toEqual(placement.size);
      expect(node.pinned).toBe(placement.pinned);
      expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true);
      expect(node.size.width).toBeGreaterThan(0);
      expect(node.size.height).toBeGreaterThan(0);
    }
    expect(projected.viewport).toEqual(view.viewport);
  });

  it.each(records)('%s: returns every parent before its children', (_name, record) => {
    const projected = projectView(record);
    const seen = new Set<string>();
    for (const node of projected.nodes) {
      if (node.parentId) expect(seen.has(node.parentId)).toBe(true);
      seen.add(node.id);
    }
    expect(seen.size).toBe(projected.nodes.length);
  });

  it.each(records)('%s: projects the same input to a deep-equal, byte-equal result', (_name, record) => {
    const first = projectView(record);
    const second = projectView(record);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('hides a collapsed group\'s descendants and their wires, and restores them on uncollapse', () => {
    let groupsChecked = 0;

    for (const [name, record] of records) {
      const base = projectView(record);
      for (const group of Object.values(record.nodes).filter((node) => node.kind === 'group')) {
        const inside = containedNodeIds(record, group.id);
        if (inside.length === 0) continue;
        groupsChecked += 1;

        const collapsedRecord = withActiveView(record, { collapsedNodeIds: [group.id] });
        const collapsed = projectView(collapsedRecord);
        const visible = new Set(collapsed.nodes.map((node) => node.id as string));

        expect(`${name}:${visible.has(group.id)}`).toBe(`${name}:true`);
        for (const id of inside) expect(`${name}:${id}:${visible.has(id)}`).toBe(`${name}:${id}:false`);
        expect(collapsed.wires).toEqual(base.wires.filter((wire) =>
          !inside.includes(wire.source.nodeId) && !inside.includes(wire.target.nodeId)));
        expect(collapsed.collapsedNodeIds).toEqual([group.id]);

        const restored = projectView(withActiveView(collapsedRecord, { collapsedNodeIds: [] }));
        expect(restored).toEqual(base);
      }
    }

    expect(groupsChecked).toBeGreaterThan(0);
  });

  it('removes the nodes of a hidden kind and every wire attached to them', () => {
    let kindsChecked = 0;

    for (const [name, record] of records) {
      const base = projectView(record);
      const kinds = [...new Set(Object.values(record.nodes).map((node) => node.kind))].sort();

      for (const kind of kinds) {
        kindsChecked += 1;
        const projected = projectView(withActiveView(record, { hiddenKinds: [kind] }));
        const visible = new Set(projected.nodes.map((node) => node.id as string));
        const removed = base.nodes
          .filter((node) => !visible.has(node.id))
          .map((node) => node.id as string);

        expect(projected.nodes.map((node) => node.kind)).not.toContain(kind);
        expect(removed).toEqual(expect.arrayContaining(
          base.nodes.filter((node) => node.kind === kind).map((node) => node.id as string),
        ));
        // Nothing may be left pointing at a container that is no longer there.
        for (const node of projected.nodes) {
          if (node.parentId) expect(`${name}:${visible.has(node.parentId)}`).toBe(`${name}:true`);
        }
        expect(projected.wires).toEqual(base.wires.filter((wire) =>
          !removed.includes(wire.source.nodeId) && !removed.includes(wire.target.nodeId)));
        expect(projected.hiddenKinds).toEqual([kind]);
      }
    }

    expect(kindsChecked).toBeGreaterThan(0);
  });

  it('refuses to project a view or layout that does not exist', () => {
    const [, record] = records[0];

    expect(() => projectView(record, 'view-missing' as ViewId)).toThrow('unknown-view:view-missing');
    expect(() => projectView({
      ...record,
      views: {
        ...record.views,
        [record.activeViewId]: {
          ...record.views[record.activeViewId],
          layoutId: 'layout-missing' as CanvasView['layoutId'],
        },
      },
    })).toThrow('unknown-layout:layout-missing');
  });

  it('excludes a wire whose endpoint is hidden rather than leaving it dangling', () => {
    const [, record] = records.find(([name]) => name === 'messaging-scope.json') as [string, DiagramRecord];
    const wire = Object.values(record.wires)[0];
    const hiddenKind = record.nodes[wire.source.nodeId].kind as NodeKind;

    const projected = projectView(withActiveView(record, { hiddenKinds: [hiddenKind] }));
    const visible = new Set(projected.nodes.map((node) => node.id as NodeId));

    expect(visible.has(wire.source.nodeId)).toBe(false);
    expect(projected.wires.map((item) => item.id)).not.toContain(wire.id);
    for (const item of projected.wires) {
      expect(visible.has(item.source.nodeId) && visible.has(item.target.nodeId)).toBe(true);
    }
  });
});
