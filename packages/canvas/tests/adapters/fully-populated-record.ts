import type { CanvasView, DiagramLayout as CanvasLayout, DiagramNode as CanvasNode,
  DiagramNodePlacement as NodePlacement, DiagramRecord, DiagramWire as CanvasWire,
  DiagramWireRouteHint as WireRouteHint, TreeRow } from '@novakai/canvas';

export function fullyPopulatedRecord(): DiagramRecord {
  const layoutHierarchyId = 'layout-hierarchy';
  const layoutFlowId = 'layout-flow';
  const viewId = 'view-main';
  const rootNode: CanvasNode = {
    id: 'root' as never,
    kind: 'group',
    label: 'Root',
    description: 'The root group node.',
    interfaceIds: ['iface-1' as never],
    typeIds: ['type-1' as never],
  };
  const childNode: CanvasNode = {
    id: 'child' as never,
    kind: 'module',
    label: 'Child',
    parentId: 'root' as never,
    interfaceIds: ['iface-child-1' as never, 'iface-child-2' as never],
    typeIds: [],
    subjectRef: { namespace: 'ns', id: 'subject-1' },
  };
  const expanderNode: CanvasNode = {
    id: 'expander' as never,
    kind: 'object',
    label: 'Expander',
    interfaceIds: ['iface-expander-1' as never, 'iface-expander-2' as never, 'iface-expander-3' as never],
    typeIds: [],
    expandsToDiagramId: 'other-diagram' as never,
  };
  const treeRows: TreeRow[] = [
    { id: 'row-1', kind: 'project', status: 'active', badges: ['flagged'], label: 'Row One' },
    { id: 'row-2', kind: 'task', parentRowId: 'row-1', badges: [] },
  ];
  const treeNode: CanvasNode = {
    id: 'tree' as never, kind: 'tree', label: 'Tree', interfaceIds: [], typeIds: [], rows: treeRows,
  };
  const metricNode: CanvasNode = {
    id: 'metric' as never,
    kind: 'metric',
    label: 'Success rate',
    interfaceIds: [],
    typeIds: [],
    value: '92%',
    detail: '12 of 13 runs',
    status: 'success',
  };
  const iconCardNode: CanvasNode = {
    id: 'icon-card' as never,
    kind: 'icon-card',
    label: 'Automated checks',
    description: 'Every change is verified.',
    interfaceIds: [],
    typeIds: [],
    icon: 'check',
  };
  const calloutStackNode: CanvasNode = {
    id: 'callout-stack' as never,
    kind: 'callout-stack',
    label: 'Release decision',
    interfaceIds: [],
    typeIds: [],
    callouts: [
      { id: 'evidence', kind: 'info', text: 'Evidence is complete' },
      { id: 'decision', kind: 'decision', text: 'Ship the release' },
    ],
  };
  const oouxNode: CanvasNode = {
    id: 'ooux-object' as never, kind: 'ooux-object', label: 'Organization',
    interfaceIds: [], typeIds: [], objectRef: 'organization',
    oouxRows: [
      { kind: 'attribute', id: 'org-name', name: 'org_name', valueType: 'string', role: 'core', traits: [] },
      { kind: 'cta', id: 'invite-member', name: 'inviteMember', role: 'admin' },
    ],
  };
  const wireOne: CanvasWire = {
    id: 'wire-1' as never,
    kind: 'owns',
    label: 'owns',
    source: { nodeId: rootNode.id, anchor: { side: 'top', ordinal: 0 }, cardinality: 'one' },
    target: { nodeId: childNode.id, anchor: { side: 'right', ordinal: 1 }, cardinality: 'zero-or-many' },
  };
  const wireTwo: CanvasWire = {
    id: 'wire-2' as never,
    kind: 'references',
    label: 'references',
    source: { nodeId: childNode.id, anchor: { side: 'bottom', ordinal: 0 } },
    target: { nodeId: expanderNode.id, anchor: { side: 'left', ordinal: 2 } },
  };
  const placements: Record<string, NodePlacement> = {
    [rootNode.id]: {
      nodeId: rootNode.id, position: { x: 0, y: 0 }, size: { width: 120, height: 80 }, pinned: true,
    },
    [childNode.id]: {
      nodeId: childNode.id, position: { x: 200, y: 0 }, size: { width: 120, height: 80 }, pinned: false,
    },
    [expanderNode.id]: {
      nodeId: expanderNode.id, position: { x: 400, y: 0 }, size: { width: 120, height: 80 }, pinned: false,
    },
    [treeNode.id]: {
      nodeId: treeNode.id, position: { x: 600, y: 0 }, size: { width: 120, height: 80 }, pinned: false,
    },
    [metricNode.id]: {
      nodeId: metricNode.id, position: { x: 800, y: 0 }, size: { width: 200, height: 126 }, pinned: false,
    },
    [iconCardNode.id]: {
      nodeId: iconCardNode.id, position: { x: 1040, y: 0 }, size: { width: 280, height: 120 }, pinned: false,
    },
    [calloutStackNode.id]: {
      nodeId: calloutStackNode.id, position: { x: 1360, y: 0 }, size: { width: 280, height: 156 }, pinned: false,
    },
    [oouxNode.id]: {
      nodeId: oouxNode.id, position: { x: 1680, y: 0 }, size: { width: 340, height: 220 }, pinned: false,
    },
  };
  const wireRouteHint: WireRouteHint = {
    wireId: wireOne.id,
    preferredSourceSide: 'top',
    preferredTargetSide: 'right',
    waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
  };
  const hierarchyLayout: CanvasLayout = {
    id: layoutHierarchyId as never,
    name: 'Hierarchy',
    strategy: 'hierarchy',
    placements,
    wireRouteHints: { [wireOne.id]: wireRouteHint },
  };
  const flowLayout: CanvasLayout = {
    id: layoutFlowId as never,
    name: 'Flow',
    strategy: 'flow',
    placements,
    wireRouteHints: {},
  };
  const view: CanvasView = {
    id: viewId as never,
    name: 'Main',
    layoutId: hierarchyLayout.id,
    viewport: { x: 0, y: 0, zoom: 1 },
    collapsedNodeIds: [childNode.id],
    hiddenKinds: ['tree'],
  };
  return {
    schemaVersion: 3,
    id: 'full-record' as never,
    name: 'Fully Populated',
    status: 'active',
    revision: 1,
    nodes: {
      [rootNode.id]: rootNode,
      [childNode.id]: childNode,
      [expanderNode.id]: expanderNode,
      [treeNode.id]: treeNode,
      [metricNode.id]: metricNode,
      [iconCardNode.id]: iconCardNode,
      [calloutStackNode.id]: calloutStackNode,
      [oouxNode.id]: oouxNode,
    },
    wires: { [wireOne.id]: wireOne, [wireTwo.id]: wireTwo },
    interfaces: {
      'iface-1': {
        id: 'iface-1' as never, ownerId: rootNode.id, name: 'doThing', accepts: ['string'], returns: ['void'],
      },
      'iface-child-1': { id: 'iface-child-1' as never, ownerId: childNode.id, name: 'start', accepts: [], returns: [] },
      'iface-child-2': { id: 'iface-child-2' as never, ownerId: childNode.id, name: 'stop', accepts: [], returns: [] },
      'iface-expander-1': { id: 'iface-expander-1' as never, ownerId: expanderNode.id, name: 'open', accepts: [], returns: [] },
      'iface-expander-2': { id: 'iface-expander-2' as never, ownerId: expanderNode.id, name: 'close', accepts: [], returns: [] },
      'iface-expander-3': { id: 'iface-expander-3' as never, ownerId: expanderNode.id, name: 'expand', accepts: [], returns: [] },
    },
    types: {
      'type-1': { id: 'type-1' as never, name: 'Thing', fields: ['name'] },
    },
    layouts: { [hierarchyLayout.id]: hierarchyLayout, [flowLayout.id]: flowLayout },
    views: { [view.id]: view },
    activeViewId: view.id,
    subjectRef: { namespace: 'ns', id: 'record-subject' },
    sourceRefs: [{ namespace: 'ns', id: 'source-1', label: 'Source One' }],
    appliedOperations: {
      'op-1': {
        operationId: 'op-1',
        revision: 1,
        actor: { id: 'agent-1', kind: 'agent' },
        timestamp: '2024-01-01T00:00:00.000Z',
        provenance: { source: 'agent', sourceRef: 'ref' },
        commandKinds: ['node.add'],
      },
    },
  };
}
