import {
  canonicalNodeAppearance, type ContainerArrangement,
} from '../../../contract/schemas/presentation.ts';
import { reflowPresentation } from '../../domain/diagram-geometry.ts';
import type { DiagramRecord } from '../../../contract/records/index.ts';
import type { FlowId } from '../../../contract/brands.ts';
import { compileFlows } from '../../domain/flows.ts';
import { canonicalWireAppearance } from '../../../contract/schemas/wire-appearance.ts';
import { directChildIds } from './arrangement.ts';
import type { RecordCommand } from '../../../contract/workspace.ts';

type Targeted = Extract<RecordCommand, { kind:
  'layout.nodeAppearance.set' | 'layout.wireAppearance.set' | 'layout.arrangement.set' }>;

function activeLayout(record: DiagramRecord) {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  const layout = record.layouts[view.layoutId];
  if (!layout) throw new Error(`unknown-layout:${view.layoutId}`);
  return layout;
}

/** Selects one semantic overlay while leaving the record's basemap byte-for-byte unchanged. */
export function activateFlow(record: DiagramRecord, flowId: FlowId | undefined): DiagramRecord {
  const library = compileFlows(record);
  if (flowId !== undefined && !library.has(flowId)) return record;
  const next = structuredClone(record);
  const view = next.views[next.activeViewId];
  if (!view) return record;
  if (flowId === undefined) delete view.flowId;
  else view.flowId = flowId;
  return next;
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

/** The definition payloads one node renders, so replacement can find the nodes it resized. */
function definitionState(record: DiagramRecord, nodeId: string): string {
  const node = record.nodes[nodeId];
  if (!node) return '';
  return JSON.stringify([
    node.interfaceIds.map((id) => record.interfaces[id] ?? null),
    node.typeIds.map((id) => record.types[id] ?? null),
  ]);
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
    case 'diagram.definitions.replace':
      resizedNodeIds = Object.keys(next.nodes)
        .filter((id) => definitionState(previous, id) !== definitionState(next, id));
      arrangementAffectedIds = resizedNodeIds;
      break;
  }
  return resizedNodeIds.length || arrangementAffectedIds.length
    ? reflowPresentation(next, { resizedNodeIds, autoSizedNodeIds, arrangementAffectedIds }) : next;
}

export function isTargetedPresentation(command: RecordCommand): command is Targeted {
  return command.kind === 'layout.nodeAppearance.set'
    || command.kind === 'layout.wireAppearance.set'
    || command.kind === 'layout.arrangement.set';
}
