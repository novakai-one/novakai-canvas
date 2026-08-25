import type { DiagramRecord } from '../../domain/records.ts';
import type { RecordCommand } from './contract.ts';
import { applyDefinitionReplacement } from './definition-command.ts';
import { applyNodeCommand } from './node-command-application.ts';
import {
  applyTargetedPresentation, isTargetedPresentation, reflowAfterCommand,
} from './presentation-commands.ts';
import { applyWireCommand } from './wire-command.ts';

type View = DiagramRecord['views'][string];
type WireCommand = Extract<RecordCommand, { kind: `wire.${string}` }>;
type InterfaceCommand = Extract<RecordCommand, { kind: `interface.${string}` }>;
type ViewCommand = Extract<RecordCommand, { kind: `view.${string}` }>;

function activeView(record: DiagramRecord): View {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  return view;
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
  else if (command.kind.startsWith('wire.')) applyWireCommand(next, layout, command as WireCommand);
  else if (command.kind.startsWith('interface.')) {
    applyInterface(next, command as InterfaceCommand);
  } else if (command.kind.startsWith('view.')) applyView(view, command as ViewCommand);
  else if (command.kind === 'layout.presentation.replace') {
    layout.appearanceByNodeId = structuredClone(command.appearanceByNodeId);
    layout.appearanceByWireId = structuredClone(command.appearanceByWireId);
    layout.arrangementByContainerId = structuredClone(command.arrangementByContainerId);
  } else if (isTargetedPresentation(command)) {
    applyTargetedPresentation(next, command);
  } else if (command.kind === 'diagram.definitions.replace') {
    applyDefinitionReplacement(next, command);
  } else if (command.kind === 'diagram.rename') next.name = command.name;
  else if (command.kind === 'diagram.setOrientation') {
    if (command.orientation === undefined) delete next.orientation;
    else next.orientation = command.orientation;
  }
  return reflowAfterCommand(record, next, command);
}
