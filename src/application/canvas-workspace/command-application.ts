import type { WireRouteHint } from '../../domain/records.ts';
import type { DiagramRecord } from '../../domain/records.ts';
import { arrangementCoverageFailure, reconcileArrangementChildren } from './arrangement.ts';
import type { RecordCommand } from './contract.ts';

type Layout = DiagramRecord['layouts'][string];
type View = DiagramRecord['views'][string];
type NodeCommand = Extract<RecordCommand, { kind: `node.${string}` }>;
type WireCommand = Extract<RecordCommand, { kind: `wire.${string}` }>;
type InterfaceCommand = Extract<RecordCommand, { kind: `interface.${string}` }>;
type ViewCommand = Extract<RecordCommand, { kind: `view.${string}` }>;

function activeView(record: DiagramRecord): View {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  return view;
}

function requireArrangementCoverage(record: DiagramRecord): void {
  const failure = arrangementCoverageFailure(record);
  if (failure) throw new Error(failure);
}

function addNode(
  record: DiagramRecord,
  layout: Layout,
  command: Extract<NodeCommand, { kind: 'node.add' }>,
): void {
  record.nodes[command.node.id] = command.node;
  layout.placements[command.node.id] = {
    nodeId: command.node.id as never,
    position: command.placement.position,
    size: command.placement.size,
    pinned: false,
  };
  if (command.node.parentId) reconcileArrangementChildren(record, command.node.parentId as string);
  requireArrangementCoverage(record);
}

function reparentNode(
  record: DiagramRecord,
  command: Extract<NodeCommand, { kind: 'node.reparent' }>,
): void {
  const previousParentId = record.nodes[command.id].parentId as string | undefined;
  if (command.parentId) record.nodes[command.id].parentId = command.parentId as never;
  else delete record.nodes[command.id].parentId;
  if (previousParentId) reconcileArrangementChildren(record, previousParentId);
  if (command.parentId) reconcileArrangementChildren(record, command.parentId);
  requireArrangementCoverage(record);
}

function removeNode(record: DiagramRecord, view: View, nodeId: string): void {
  const owned = record.nodes[nodeId];
  const previousParentId = owned.parentId as string | undefined;
  for (const interfaceId of owned.interfaceIds) delete record.interfaces[interfaceId];
  delete record.nodes[nodeId];
  const removedWireIds = Object.values(record.wires)
    .filter((wire) => wire.source.nodeId === nodeId || wire.target.nodeId === nodeId)
    .map((wire) => wire.id as string);
  record.wires = Object.fromEntries(Object.entries(record.wires).filter(
    ([wireId]) => !removedWireIds.includes(wireId),
  ));
  for (const layout of Object.values(record.layouts)) {
    delete layout.placements[nodeId];
    if (layout.appearanceByNodeId) delete layout.appearanceByNodeId[nodeId];
    for (const wireId of removedWireIds) {
      delete layout.wireRouteHints[wireId];
      if (layout.appearanceByWireId) delete layout.appearanceByWireId[wireId];
    }
    if (!layout.arrangementByContainerId) continue;
    delete layout.arrangementByContainerId[nodeId];
    for (const arrangement of Object.values(layout.arrangementByContainerId)) {
      arrangement.childIds = arrangement.childIds.filter((childId) => childId !== nodeId);
    }
  }
  if (previousParentId) reconcileArrangementChildren(record, previousParentId);
  requireArrangementCoverage(record);
  view.collapsedNodeIds = view.collapsedNodeIds.filter((id) => id !== nodeId);
}

function applyNode(record: DiagramRecord, layout: Layout, view: View, command: NodeCommand): void {
  switch (command.kind) {
    case 'node.add': addNode(record, layout, command); return;
    case 'node.move':
      layout.placements[command.id] = { ...layout.placements[command.id], position: command.position };
      return;
    case 'node.resize':
      layout.placements[command.id] = { ...layout.placements[command.id], size: command.size };
      return;
    case 'node.pin':
      layout.placements[command.id] = { ...layout.placements[command.id], pinned: command.pinned };
      return;
    case 'node.update': Object.assign(record.nodes[command.id], command.patch); return;
    case 'node.reparent': reparentNode(record, command); return;
    case 'node.remove': removeNode(record, view, command.id);
  }
}

function setWireRoute(
  layout: Layout,
  command: Extract<WireCommand, { kind: 'wire.setRoute' }>,
): void {
  const existing: WireRouteHint = layout.wireRouteHints[command.id]
    ?? { wireId: command.id as never, waypoints: [] };
  const { labelPosition, preferredSourceSide, preferredTargetSide, waypoints } = command.route;
  layout.wireRouteHints[command.id] = {
    ...existing,
    ...(waypoints ? { waypoints: waypoints.map((point) => ({ ...point })) } : {}),
    ...(labelPosition === undefined ? {} : { labelPosition }),
    ...(preferredSourceSide === undefined ? {} : { preferredSourceSide }),
    ...(preferredTargetSide === undefined ? {} : { preferredTargetSide }),
  };
}

function applyWire(record: DiagramRecord, layout: Layout, command: WireCommand): void {
  switch (command.kind) {
    case 'wire.add': record.wires[command.wire.id] = command.wire; return;
    case 'wire.reconnect': {
      const wire = record.wires[command.id];
      if (command.source) wire.source = { ...wire.source, nodeId: command.source as never };
      if (command.target) wire.target = { ...wire.target, nodeId: command.target as never };
      return;
    }
    case 'wire.setRoute': setWireRoute(layout, command); return;
    case 'wire.update': Object.assign(record.wires[command.id], command.patch); return;
    case 'wire.remove':
      delete record.wires[command.id];
      for (const each of Object.values(record.layouts)) {
        delete each.wireRouteHints[command.id];
        if (each.appearanceByWireId) delete each.appearanceByWireId[command.id];
      }
  }
}

function applyInterface(record: DiagramRecord, command: InterfaceCommand): void {
  switch (command.kind) {
    case 'interface.add':
      record.interfaces[command.iface.id] = command.iface;
      record.nodes[command.ownerId].interfaceIds = [
        ...record.nodes[command.ownerId].interfaceIds, command.iface.id,
      ] as never;
      return;
    case 'interface.update': Object.assign(record.interfaces[command.id], command.patch); return;
    case 'interface.remove': {
      const owner = record.interfaces[command.id].ownerId;
      delete record.interfaces[command.id];
      if (record.nodes[owner]) {
        record.nodes[owner].interfaceIds = record.nodes[owner].interfaceIds
          .filter((id) => id !== command.id) as never;
      }
    }
  }
}

function applyView(view: View, command: ViewCommand): void {
  if (command.kind === 'view.setViewport') {
    view.viewport = command.viewport;
    return;
  }
  const collapsed = new Set(view.collapsedNodeIds as string[]);
  if (command.collapsed) collapsed.add(command.id);
  else collapsed.delete(command.id);
  view.collapsedNodeIds = [...collapsed].sort() as never;
}

/** Applies one already-validated command to a clone of the supplied record. */
export function applyRecordCommand(record: DiagramRecord, command: RecordCommand): DiagramRecord {
  const next = structuredClone(record);
  const view = activeView(next);
  const layout = next.layouts[view.layoutId];
  if (command.kind.startsWith('node.')) applyNode(next, layout, view, command as NodeCommand);
  else if (command.kind.startsWith('wire.')) applyWire(next, layout, command as WireCommand);
  else if (command.kind.startsWith('interface.')) {
    applyInterface(next, command as InterfaceCommand);
  } else if (command.kind.startsWith('view.')) applyView(view, command as ViewCommand);
  else if (command.kind === 'layout.presentation.replace') {
    layout.appearanceByNodeId = structuredClone(command.appearanceByNodeId);
    layout.appearanceByWireId = structuredClone(command.appearanceByWireId);
    layout.arrangementByContainerId = structuredClone(command.arrangementByContainerId);
  } else if (command.kind === 'diagram.rename') next.name = command.name;
  return next;
}
