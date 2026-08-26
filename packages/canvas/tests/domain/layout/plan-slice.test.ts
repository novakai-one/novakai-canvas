import { describe, expect, it } from 'vitest';
import { recordNamed, graphNamed, planned, containedIds, withPinned, expectUntouchedOutside, defaultLayoutOptions, graphOfDiagram, planSliceLayout } from './plan-fixture.ts';
import type { NodeId, LayoutGraph, LayoutSliceTarget } from './plan-fixture.ts';

describe('slice layout', () => {
  it('moves a group\'s contents and nothing else in the diagram', () => {
    const graph = graphNamed('command-overview');
    const groupId = 'command-overview--backend' as NodeId;
    const target: LayoutSliceTarget = { kind: 'group', groupId };
    const before = graph.placements[groupId];

    const after = planned(planSliceLayout(graph, target, { strategy: 'hierarchy' }));

    expectUntouchedOutside(graph, after, [groupId, ...containedIds(graph, groupId)]);
    // The boundary group is the named exception: it may resize, it may not move.
    expect(after[groupId].position).toEqual(before.position);
  });

  it('grows a boundary group that is too small to hold its own children', () => {
    const graph = graphNamed('command-overview');
    const groupId = 'command-overview--backend' as NodeId;
    const undersized: LayoutGraph = {
      ...graph,
      placements: {
        ...graph.placements,
        [groupId]: { ...graph.placements[groupId], size: { width: 10, height: 10 } },
      },
    };

    const after = planned(planSliceLayout(undersized, { kind: 'group', groupId }, { strategy: 'hierarchy' }));

    expect(after[groupId].size.width).toBeGreaterThan(10);
    expect(after[groupId].size.height).toBeGreaterThan(10);
    expect(after[groupId].position).toEqual(graph.placements[groupId].position);
    expectUntouchedOutside(undersized, after, [groupId, ...containedIds(graph, groupId)]);
  });

  it('resizes a boundary group to contain every child it laid out', () => {
    const graph = graphNamed('command-mission-model');
    const groupId = 'command-mission-model--durable-hierarchy' as NodeId;
    const after = planned(planSliceLayout(graph, { kind: 'group', groupId }, { strategy: 'hierarchy' }));

    const { groupPadding } = defaultLayoutOptions;
    for (const childId of Object.keys(graph.nodes).filter((id) => graph.nodes[id].parentId === groupId)) {
      const child = after[childId];
      expect(child.position.x).toBeGreaterThanOrEqual(groupPadding);
      expect(child.position.y).toBeGreaterThanOrEqual(groupPadding);
      expect(child.position.x + child.size.width).toBeLessThanOrEqual(after[groupId].size.width);
      expect(child.position.y + child.size.height).toBeLessThanOrEqual(after[groupId].size.height);
    }
  });

  it('moves only the named nodes, not the container holding them', () => {
    const graph = graphNamed('messaging-scope');
    const nodeIds = ['msg-router', 'msg-store', 'msg-channel'] as NodeId[];

    const after = planned(planSliceLayout(graph, { kind: 'nodes', nodeIds }, { strategy: 'hierarchy' }));

    expectUntouchedOutside(graph, after, nodeIds);
    expect(JSON.stringify(after['msg-router'])).not.toBe(JSON.stringify(graph.placements['msg-router']));
    // Sizes are content decisions, not layout ones: a slice re-ranks nodes, it does not rescale them.
    for (const nodeId of nodeIds) {
      expect(after[nodeId].size).toEqual(graph.placements[nodeId].size);
    }
  });

  it('reports only what actually changed', () => {
    const graph = graphNamed('messaging-scope');
    const nodeIds = ['msg-router', 'msg-store', 'msg-channel'] as NodeId[];
    const plan = planSliceLayout(graph, { kind: 'nodes', nodeIds }, { strategy: 'hierarchy' });

    if (plan.status !== 'planned') throw new Error('expected a plan');
    expect(plan.affectedNodeIds.length).toBeGreaterThan(0);
    for (const nodeId of plan.affectedNodeIds) expect(nodeIds).toContain(nodeId);
  });

  it('never moves a pinned node, in any target', () => {
    const graph = withPinned(graphNamed('messaging-scope'), 'msg-store');
    const pinned = graph.placements['msg-store'];

    for (const target of [
      { kind: 'diagram' },
      { kind: 'group', groupId: 'messaging-scope' as NodeId },
      { kind: 'nodes', nodeIds: ['msg-router', 'msg-store', 'msg-channel'] as NodeId[] },
    ] satisfies LayoutSliceTarget[]) {
      const after = planned(planSliceLayout(graph, target, { strategy: 'hierarchy' }));
      expect(after['msg-store']).toBe(pinned);
    }
  });

  it('rejects a node set whose members live in different containers', () => {
    const graph = graphNamed('command-overview');
    const backendChild = Object.keys(graph.nodes)
      .find((id) => graph.nodes[id].parentId === 'command-overview--backend') as string;
    const frontendChild = Object.keys(graph.nodes)
      .find((id) => graph.nodes[id].parentId === 'command-overview--frontend') as string;

    expect(planSliceLayout(graph, {
      kind: 'nodes', nodeIds: [backendChild, frontendChild] as NodeId[],
    })).toEqual({ status: 'rejected', reason: 'mixed-parent-target' });
  });

  it('fails a target that names nothing to arrange', () => {
    const graph = graphNamed('messaging-scope');

    expect(planSliceLayout(graph, { kind: 'nodes', nodeIds: [] }))
      .toEqual({ status: 'failed', reason: 'empty-target' });
    expect(planSliceLayout(graph, { kind: 'nodes', nodeIds: ['no-such-node' as NodeId] }))
      .toEqual({ status: 'failed', reason: 'empty-target' });
    expect(planSliceLayout(graph, { kind: 'group', groupId: 'no-such-group' as NodeId }))
      .toEqual({ status: 'failed', reason: 'unknown-group' });
    expect(planSliceLayout(graph, { kind: 'group', groupId: 'msg-router' as NodeId }))
      .toEqual({ status: 'failed', reason: 'unknown-group' });
    expect(planSliceLayout({ nodes: {}, wires: {}, placements: {} }, { kind: 'diagram' }))
      .toEqual({ status: 'failed', reason: 'empty-target' });
  });

  it('reads the active view\'s layout, and refuses an unknown one', () => {
    const record = recordNamed('messaging-scope');
    const graph = graphOfDiagram(record);

    expect(graph.placements).toBe(record.layouts[record.views[record.activeViewId].layoutId].placements);
    expect(() => graphOfDiagram(record, 'layout-missing' as never)).toThrow('unknown-layout:layout-missing');
  });
});
