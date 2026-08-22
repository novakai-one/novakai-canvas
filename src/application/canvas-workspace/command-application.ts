import type { DiagramRecord, WireRouteHint } from '../../domain/records.ts';
import type { RecordCommand } from './contract.ts';
import { applyNodeCommand } from './node-command-application.ts';
import {
  applyTargetedPresentation, isTargetedPresentation, reflowAfterCommand,
} from './presentation-commands.ts';

type Layout = DiagramRecord['layouts'][string];
type View = DiagramRecord['views'][string];
type WireCommand = Extract<RecordCommand, { kind: `wire.${string}` }>;
type InterfaceCommand = Extract<RecordCommand, { kind: `interface.${string}` }>;
type ViewCommand = Extract<RecordCommand, { kind: `view.${string}` }>;

function activeView(record: DiagramRecord): View {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  return view;
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
  if (command.kind.startsWith('node.')) applyNodeCommand(next, command as Extract<
    RecordCommand, { kind: `node.${string}` }
  >);
  else if (command.kind.startsWith('wire.')) applyWire(next, layout, command as WireCommand);
  else if (command.kind.startsWith('interface.')) {
    applyInterface(next, command as InterfaceCommand);
  } else if (command.kind.startsWith('view.')) applyView(view, command as ViewCommand);
  else if (command.kind === 'layout.presentation.replace') {
    layout.appearanceByNodeId = structuredClone(command.appearanceByNodeId);
    layout.appearanceByWireId = structuredClone(command.appearanceByWireId);
    layout.arrangementByContainerId = structuredClone(command.arrangementByContainerId);
  } else if (isTargetedPresentation(command)) {
    applyTargetedPresentation(next, command);
  } else if (command.kind === 'diagram.rename') next.name = command.name;
  return reflowAfterCommand(record, next, command);
}
