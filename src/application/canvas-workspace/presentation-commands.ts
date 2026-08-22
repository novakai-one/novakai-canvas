import {
  canonicalNodeAppearance, type ContainerArrangement,
} from '../../domain/canvas-presentation.ts';
import { reflowPresentation } from '../../domain/diagram-geometry.ts';
import type { DiagramRecord } from '../../domain/records.ts';
import { canonicalWireAppearance } from '../../domain/wire-appearance.ts';
import { directChildIds } from './arrangement.ts';
import type { RecordCommand } from './contract.ts';

type Targeted = Extract<RecordCommand, { kind:
  'layout.nodeAppearance.set' | 'layout.wireAppearance.set' | 'layout.arrangement.set' }>;

function activeLayout(record: DiagramRecord) {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  const layout = record.layouts[view.layoutId];
  if (!layout) throw new Error(`unknown-layout:${view.layoutId}`);
  return layout;
}

function arrangementChildren(record: DiagramRecord, id: string): string[] {
  const children = directChildIds(record, id);
  const existing = activeLayout(record).arrangementByContainerId?.[id]?.childIds ?? [];
  const direct = new Set(children);
  const retained = existing.filter((childId, index) =>
    direct.has(childId) && existing.indexOf(childId) === index);
  return [...retained, ...children.filter((childId) => !retained.includes(childId))];
}

/** Applies one validated targeted presentation command to a mutable record clone. */
export function applyTargetedPresentation(record: DiagramRecord, command: Targeted): void {
  const layout = activeLayout(record);
  if (command.kind === 'layout.nodeAppearance.set') {
    layout.appearanceByNodeId ??= {};
    if (Object.keys(command.appearance).length) {
      layout.appearanceByNodeId[command.id] = canonicalNodeAppearance(command.appearance);
    } else delete layout.appearanceByNodeId[command.id];
    return;
  }
  if (command.kind === 'layout.wireAppearance.set') {
    layout.appearanceByWireId ??= {};
    if (Object.keys(command.appearance).length) {
      layout.appearanceByWireId[command.id] = canonicalWireAppearance(command.appearance);
    } else delete layout.appearanceByWireId[command.id];
    return;
  }
  layout.arrangementByContainerId ??= {};
  if (!command.arrangement) {
    delete layout.arrangementByContainerId[command.id];
    return;
  }
  layout.arrangementByContainerId[command.id] = {
    ...command.arrangement,
    childIds: arrangementChildren(record, command.id),
  } as ContainerArrangement;
}

function endpointIds(record: DiagramRecord, wireId: string): string[] {
  const wire = record.wires[wireId];
  return wire ? [wire.source.nodeId as string, wire.target.nodeId as string] : [];
}

/** Reflows geometry affected by one semantic or presentation mutation. */
export function reflowAfterCommand(
  previous: DiagramRecord,
  next: DiagramRecord,
  command: RecordCommand,
): DiagramRecord {
  let resizedNodeIds: string[] = [];
  let autoSizedNodeIds: string[] = [];
  let arrangementAffectedIds: string[] = [];
  switch (command.kind) {
    case 'layout.nodeAppearance.set':
      resizedNodeIds = [command.id];
      arrangementAffectedIds = [command.id];
      break;
    case 'layout.arrangement.set':
      if (command.arrangement) arrangementAffectedIds = [command.id];
      break;
    case 'node.add':
      if (command.node.parentId) arrangementAffectedIds = [command.node.parentId as string];
      break;
    case 'node.update':
      resizedNodeIds = [command.id];
      arrangementAffectedIds = [command.id];
      break;
    case 'node.resize':
    case 'node.content.set':
      resizedNodeIds = [command.id];
      arrangementAffectedIds = [command.id];
      break;
    case 'node.autoSize':
      resizedNodeIds = [command.id];
      autoSizedNodeIds = [command.id];
      arrangementAffectedIds = [command.id];
      break;
    case 'node.reparent':
      // Membership changes immediately, but placement remains under the user's hand.
      // Reparenting itself is not a request to rerun the container's arrangement.
      break;
    case 'node.remove': {
      const oldParent = previous.nodes[command.id]?.parentId as string | undefined;
      arrangementAffectedIds = oldParent ? [oldParent] : [];
      break;
    }
    case 'wire.add':
      arrangementAffectedIds = [command.wire.source.nodeId, command.wire.target.nodeId] as string[];
      break;
    case 'wire.reconnect':
      arrangementAffectedIds = [...endpointIds(previous, command.id), ...endpointIds(next, command.id)];
      break;
    case 'wire.remove':
      arrangementAffectedIds = endpointIds(previous, command.id);
      break;
    case 'interface.add':
      resizedNodeIds = [command.ownerId];
      arrangementAffectedIds = [command.ownerId];
      break;
    case 'interface.update': {
      const ownerId = next.interfaces[command.id]?.ownerId as string | undefined;
      if (ownerId) resizedNodeIds = arrangementAffectedIds = [ownerId];
      break;
    }
    case 'interface.remove': {
      const ownerId = previous.interfaces[command.id]?.ownerId as string | undefined;
      if (ownerId) resizedNodeIds = arrangementAffectedIds = [ownerId];
      break;
    }
  }
  return resizedNodeIds.length || arrangementAffectedIds.length
    ? reflowPresentation(next, { resizedNodeIds, autoSizedNodeIds, arrangementAffectedIds }) : next;
}

export function isTargetedPresentation(command: RecordCommand): command is Targeted {
  return command.kind === 'layout.nodeAppearance.set'
    || command.kind === 'layout.wireAppearance.set'
    || command.kind === 'layout.arrangement.set';
}
