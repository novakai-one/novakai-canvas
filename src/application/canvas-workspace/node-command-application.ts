import { componentFor } from '../../components/registry.ts';
import type { DiagramRecord } from '../../domain/records.ts';
import { arrangementCoverageFailure, reconcileArrangementChildren } from './arrangement.ts';
import type { RecordCommand } from './contract.ts';

type Layout = DiagramRecord['layouts'][string];
type View = DiagramRecord['views'][string];
type NodeCommand = Extract<RecordCommand, { kind: `node.${string}` }>;

function active(record: DiagramRecord): { layout: Layout; view: View } {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  const layout = record.layouts[view.layoutId];
  if (!layout) throw new Error(`unknown-layout:${view.layoutId}`);
  return { layout, view };
}

function requireArrangementCoverage(record: DiagramRecord): void {
  const failure = arrangementCoverageFailure(record);
  if (failure) throw new Error(failure);
}

function addNode(record: DiagramRecord, layout: Layout, command: Extract<NodeCommand, {
  kind: 'node.add';
}>): void {
  record.nodes[command.node.id] = command.node;
  layout.placements[command.node.id] = {
    nodeId: command.node.id as never,
    position: command.placement.position,
    size: command.placement.size,
    ...(command.placement.sizeMode ? { sizeMode: command.placement.sizeMode } : {}),
    pinned: false,
  };
  if (command.node.parentId) reconcileArrangementChildren(record, command.node.parentId as string);
  requireArrangementCoverage(record);
}

function reparentNode(record: DiagramRecord, command: Extract<NodeCommand, {
  kind: 'node.reparent';
}>): void {
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

function setContent(record: DiagramRecord, command: Extract<NodeCommand, {
  kind: 'node.content.set';
}>): void {
  const node = record.nodes[command.id];
  const editor = componentFor(node.kind).contentEditors?.find(
    (candidate) => candidate.field === command.field,
  );
  const content = node as unknown as Record<string, unknown>;
  if (editor && Array.isArray(command.value) && command.value.length === 0) {
    delete content[command.field];
  } else content[command.field] = structuredClone(command.value);
}

/** Applies one validated node command to the mutable candidate record. */
export function applyNodeCommand(record: DiagramRecord, command: NodeCommand): void {
  const { layout, view } = active(record);
  switch (command.kind) {
    case 'node.add': addNode(record, layout, command); return;
    case 'node.move':
      layout.placements[command.id] = { ...layout.placements[command.id], position: command.position };
      return;
    case 'node.resize':
      layout.placements[command.id] = {
        ...layout.placements[command.id], size: command.size,
        ...(command.sizeMode ? { sizeMode: command.sizeMode } : {}),
      };
      return;
    case 'node.autoSize':
      layout.placements[command.id] = { ...layout.placements[command.id], sizeMode: 'auto' };
      return;
    case 'node.pin':
      layout.placements[command.id] = { ...layout.placements[command.id], pinned: command.pinned };
      return;
    case 'node.update': Object.assign(record.nodes[command.id], command.patch); return;
    case 'node.content.set': setContent(record, command); return;
    case 'node.reparent': reparentNode(record, command); return;
    case 'node.remove': removeNode(record, view, command.id);
  }
}
