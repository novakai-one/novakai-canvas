import { describe, expect, it } from 'vitest';
import { defaultPreferences, resolveCanvasTheme } from '@novakai/canvas';
import { asId } from '@novakai/canvas';
import type { NodeId } from '@novakai/canvas';
import { projectView } from '@novakai/canvas';
import type {
  DiagramNode as CanvasNode,
  DiagramWire as CanvasWire,
  DiagramRecord,
} from '@novakai/canvas';
import { flowNodeType, projectEdges, projectNodes, scopeDepth } from './projection';
import { mergeInFlight } from './in-flight';

function node(id: string, kind: CanvasNode['kind'], parentId?: string): CanvasNode {
  return {
    id: asId<NodeId>(id),
    kind,
    label: id,
    parentId: parentId ? asId<NodeId>(parentId) : undefined,
    interfaceIds: [],
    typeIds: [],
  };
}

function wire(id: string, source: string, target: string): CanvasWire {
  return {
    id: asId(id),
    kind: 'references',
    label: id,
    source: { nodeId: asId<NodeId>(source) },
    target: { nodeId: asId<NodeId>(target) },
  };
}

/** One record shaped like the migrated ones: a root group holding nested objects. */
function record(nodes: CanvasNode[], wires: CanvasWire[] = []): DiagramRecord {
  return {
    schemaVersion: 3,
    id: asId('map'),
    name: 'Map',
    status: 'active',
    revision: 1,
    nodes: Object.fromEntries(nodes.map((each) => [each.id, each])),
    wires: Object.fromEntries(wires.map((each) => [each.id, each])),
    interfaces: {
      'iface-a': { id: 'iface-a', ownerId: 'module', name: 'send', accepts: [], returns: [] },
    },
    types: { 'type-a': { id: 'type-a', name: 'Envelope', fields: ['id'] } },
    layouts: {
      'layout-default': {
        id: asId('layout-default'),
        name: 'Default',
        strategy: 'manual',
        placements: Object.fromEntries(nodes.map((each, index) => [each.id, {
          nodeId: each.id,
          position: { x: index * 100, y: index * 50 },
          size: { width: 200, height: 110 },
          pinned: false,
        }])),
        wireRouteHints: {},
      },
    },
    views: {
      'view-default': {
        id: asId('view-default'),
        name: 'Default',
        layoutId: asId('layout-default'),
        viewport: { x: 0, y: 0, zoom: 1 },
        collapsedNodeIds: [],
        hiddenKinds: [],
      },
    },
    activeViewId: asId('view-default'),
    sourceRefs: [],
    appliedOperations: {},
  };
}

function input(source: DiagramRecord) {
  return {
    record: source,
    view: projectView(source),
    preferences: defaultPreferences,
    theme: resolveCanvasTheme(defaultPreferences.appearance),
    selection: null,
    editable: true,
    select: () => {},
  };
}

describe('scopeDepth', () => {
  it('walks the parent chain and stops on missing parents and cycles', () => {
    const nodes = {
      map: node('map', 'group'),
      zone: node('zone', 'group', 'map'),
      inner: node('inner', 'module', 'zone'),
      orphan: node('orphan', 'module', 'gone'),
      'cycle-a': node('cycle-a', 'group', 'cycle-b'),
      'cycle-b': node('cycle-b', 'group', 'cycle-a'),
    };
    expect(scopeDepth(nodes, nodes.map)).toBe(0);
    expect(scopeDepth(nodes, nodes.zone)).toBe(1);
    expect(scopeDepth(nodes, nodes.inner)).toBe(2);
    expect(scopeDepth(nodes, nodes.orphan)).toBe(0);
    expect(scopeDepth(nodes, nodes['cycle-a'])).toBe(1);
  });
});

describe('flowNodeType', () => {
  it('is the record kind itself; webRenderers resolves it to a component', () => {
    expect(flowNodeType('group')).toBe('group');
    expect(flowNodeType('comment')).toBe('comment');
    expect(flowNodeType('tree')).toBe('tree');
    expect(flowNodeType('module')).toBe('module');
  });
});

describe('projectNodes', () => {
  it('keeps the projected order, so every parent reaches React Flow before its children', () => {
    const projected = projectNodes(input(record([
      node('inner', 'module', 'zone'),
      node('map', 'group'),
      node('zone', 'group', 'map'),
    ])));
    expect(projected.map((each) => each.id)).toEqual(['map', 'zone', 'inner']);
    expect(projected.map((each) => each.parentId)).toEqual([undefined, 'map', 'zone']);
  });

  it('never fences a node inside its group — a group carries meaning, not walls', () => {
    const projected = projectNodes(input(record([
      node('map', 'group'),
      node('inner', 'module', 'map'),
    ])));
    expect(projected.every((each) => each.extent === undefined)).toBe(true);
  });

  it('makes a group click-through so its empty interior belongs to the canvas', () => {
    const projected = projectNodes(input(record([
      node('map', 'group'),
      node('inner', 'module', 'map'),
    ])));
    expect(projected.find((each) => each.id === 'map')?.style).toEqual({ pointerEvents: 'none' });
    expect(projected.find((each) => each.id === 'inner')?.style).toBeUndefined();
  });

  it('carries the geometry the view joined onto each node', () => {
    const projected = projectNodes(input(record([node('map', 'group'), node('one', 'module', 'map')])));
    expect(projected[1].position).toEqual({ x: 100, y: 50 });
    expect(projected[1].width).toBe(200);
    expect(projected[1].height).toBe(110);
  });

  it('initializes React Flow measurements from authoritative layout geometry', () => {
    const projected = projectNodes(input(record([node('map', 'group'), node('one', 'module', 'map')])));
    expect(projected[1].measured).toEqual({ width: 200, height: 110 });
  });

  it('replaces only the node under a gesture and keeps its initialized measurements', () => {
    const projected = projectNodes(input(record([
      node('map', 'group'), node('one', 'module', 'map'), node('two', 'module', 'map'),
    ])));
    const merged = mergeInFlight(projected, { one: { position: { x: 240, y: 180 } } });
    expect(merged[1]).not.toBe(projected[1]);
    expect(merged[1]).toMatchObject({
      position: { x: 240, y: 180 }, measured: { width: 200, height: 110 },
    });
    expect(merged[0]).toBe(projected[0]);
    expect(merged[2]).toBe(projected[2]);
  });

  it('resolves the interfaces and types a node names', () => {
    const withObjects = record([node('map', 'group'), node('module', 'module', 'map')]);
    withObjects.nodes.module.interfaceIds = [asId('iface-a')];
    withObjects.nodes.module.typeIds = [asId('type-a'), asId('missing')];
    const data = projectNodes(input(withObjects))[1].data;
    expect(data.interfaces.map((each) => each.name)).toEqual(['send']);
    expect(data.types.map((each) => each.name)).toEqual(['Envelope']);
  });

  it('omits a hidden group without orphaning the children it held', () => {
    const hidden = record([node('map', 'group'), node('note', 'comment', 'map')]);
    hidden.views['view-default'].hiddenKinds = ['group'];
    const projected = projectNodes(input(hidden));
    expect(projected.map((each) => each.id)).toEqual(['note']);
    expect(projected[0].parentId).toBeUndefined();
  });
});

describe('projectEdges', () => {
  it('derives flow emphasis without filtering any wire', () => {
    const wired = record(
      ['map', 'a', 'b', 'c', 'd', 'e'].map((id) => node(id, id === 'map' ? 'group' : 'module', id === 'map' ? undefined : 'map')),
      [wire('ab', 'a', 'b'), wire('bc', 'b', 'c'), wire('de', 'd', 'e')],
    );
    wired.flows = { path: { id: asId('path'), name: 'Path', steps: [{ ref: asId('ab'), ordinal: 1 }] } };
    wired.views['view-default'].flowId = asId('path');
    const edges = projectEdges(input(wired));
    expect(edges.map((edge) => [edge.id, edge.data?.emphasis])).toEqual([
      ['ab', 'focal'], ['bc', 'context'], ['de', 'muted'],
    ]);
    expect(edges.every((edge) => edge.className?.includes(`has-flow-${edge.data?.emphasis}`))).toBe(true);
  });

  it('swaps labels to step badges while a flow is active', () => {
    const wired = record(
      ['map', 'a', 'b', 'c'].map((id) => node(id, id === 'map' ? 'group' : 'module', id === 'map' ? undefined : 'map')),
      [wire('ab', 'a', 'b'), wire('bc', 'b', 'c')],
    );
    wired.flows = {
      path: {
        id: asId('path'),
        name: 'Path',
        steps: [
          { ref: asId('ab'), ordinal: 1, label: 'save()' },
          { ref: asId('bc'), ordinal: 2 },
          { ref: asId('ab'), ordinal: 3 },
        ],
      },
    };
    wired.views['view-default'].flowId = asId('path');
    const edges = projectEdges(input(wired));
    expect(edges.map((edge) => edge.data?.label)).toEqual(['1 · save()  3', '2']);
  });

  it('leaves structural labels alone and empties non-focal labels correctly', () => {
    const wired = record(
      ['map', 'a', 'b', 'c'].map((id) => node(id, id === 'map' ? 'group' : 'module', id === 'map' ? undefined : 'map')),
      [wire('ab', 'a', 'b'), wire('bc', 'b', 'c')],
    );
    expect(projectEdges(input(wired)).map((edge) => edge.data?.label)).toEqual(['ab', 'bc']);
    wired.flows = {
      path: { id: asId('path'), name: 'Path', steps: [{ ref: asId('ab'), ordinal: 1 }] },
    };
    wired.views['view-default'].flowId = asId('path');
    expect(projectEdges(input(wired)).map((edge) => edge.data?.label)).toEqual(['1', '']);
  });

  it('reads both endpoints off the record wire', () => {
    const wired = record(
      [node('map', 'group'), node('a', 'module', 'map'), node('b', 'module', 'map')],
      [wire('wire-1', 'a', 'b')],
    );
    const [edge] = projectEdges(input(wired));
    expect(edge).toMatchObject({ id: 'wire-1', source: 'a', target: 'b', type: 'elbow' });
    expect(edge.data?.label).toBe('wire-1');
  });

  it('drops a wire whose endpoint the view hid', () => {
    const wired = record(
      [node('map', 'group'), node('a', 'module', 'map'), node('note', 'comment', 'map')],
      [wire('wire-1', 'a', 'note')],
    );
    wired.views['view-default'].hiddenKinds = ['comment'];
    expect(projectEdges(input(wired))).toEqual([]);
  });

  it('marks exactly the selected node or wire neighbourhood as related', () => {
    const wired = record(
      [
        node('map', 'group'), node('a', 'module', 'map'),
        node('b', 'module', 'map'), node('c', 'module', 'map'),
      ],
      [wire('wire-ab', 'a', 'b'), wire('wire-bc', 'b', 'c')],
    );
    const nodeSelected = {
      ...input(wired), selection: { kind: 'node' as const, id: asId<NodeId>('a') },
    };
    expect(projectNodes(nodeSelected).slice(1).map((item) => [item.id, item.className])).toEqual([
      ['a', 'is-related'], ['b', 'is-related'], ['c', 'is-dimmed'],
    ]);
    expect(projectEdges(nodeSelected).map((item) => [
      item.id, item.className, item.data?.related,
    ])).toEqual([
      ['wire-ab', 'is-related', true], ['wire-bc', 'is-dimmed', false],
    ]);

    const wireSelected = {
      ...input(wired), selection: { kind: 'wire' as const, id: asId('wire-bc') },
    };
    expect(projectNodes(wireSelected).slice(1).map((item) => [item.id, item.className])).toEqual([
      ['a', 'is-dimmed'], ['b', 'is-related'], ['c', 'is-related'],
    ]);
    expect(projectEdges(wireSelected).map((item) => [item.id, item.className])).toEqual([
      ['wire-ab', 'is-dimmed'], ['wire-bc', 'is-related'],
    ]);
  });
});
