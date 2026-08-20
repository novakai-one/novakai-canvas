import { componentFor } from '../../components/registry.ts';
import {
  appearanceKeyForJsonKey, layoutPresentationSchema,
} from '../../domain/canvas-presentation.ts';
import { signatureFailure } from '../../domain/interface-signature.ts';
import type { DiagramRecord } from '../../domain/records.ts';
import { directChildIds } from './arrangement.ts';
import type { RecordCommand } from './contract.ts';

type ValidationResult = { valid: true } | { valid: false; reason: string };
type NodeCommand = Extract<RecordCommand, { kind: `node.${string}` }>;
type WireCommand = Extract<RecordCommand, { kind: `wire.${string}` }>;
type InterfaceCommand = Extract<RecordCommand, { kind: `interface.${string}` }>;
type ViewCommand = Extract<RecordCommand, { kind: `view.${string}` }>;

function requireNode(record: DiagramRecord, id: string): void {
  if (!record.nodes[id]) throw new Error(`node-not-found:${id}`);
}

function requireWireEndpoint(record: DiagramRecord, id: string): void {
  requireNode(record, id);
  if (componentFor(record.nodes[id].kind).identity?.wireEndpoint === false) {
    throw new Error(`node-not-a-wire-endpoint:${id}`);
  }
}

function requireSignature(command: Extract<InterfaceCommand, { kind: 'interface.add' | 'interface.update' }>): void {
  const signature = command.kind === 'interface.add' ? command.iface : command.patch;
  const failure = signatureFailure(signature.name, signature.accepts, signature.returns);
  if (failure) throw new Error(failure);
}

function validateParent(record: DiagramRecord, nodeId: string, parentId: string): void {
  requireNode(record, parentId);
  if (record.nodes[parentId].kind !== 'group') throw new Error(`parent-not-a-group:${parentId}`);
  let cursor: string | undefined = parentId;
  while (cursor) {
    if (cursor === nodeId) throw new Error('parent-cycle');
    cursor = record.nodes[cursor]?.parentId;
  }
}

function validateNode(record: DiagramRecord, command: NodeCommand): void {
  if (command.kind === 'node.add') {
    if (record.nodes[command.node.id]) throw new Error(`node-already-exists:${command.node.id}`);
    if (command.node.parentId) validateParent(record, command.node.id, command.node.parentId);
    return;
  }
  requireNode(record, command.id);
  if (command.kind === 'node.update') {
    const node = record.nodes[command.id];
    if (command.patch.label !== undefined && command.patch.label !== node.label
      && componentFor(node.kind).identity?.scope === 'parent') {
      throw new Error(`parent-scoped-identity-requires-recreate:${command.id}`);
    }
  }
  if (command.kind !== 'node.reparent') return;
  const node = record.nodes[command.id];
  if (command.parentId !== node.parentId
    && componentFor(node.kind).identity?.scope === 'parent') {
    throw new Error(`parent-scoped-identity-requires-recreate:${command.id}`);
  }
  if (command.parentId) validateParent(record, command.id, command.parentId);
}

function validateRoute(command: Extract<WireCommand, { kind: 'wire.setRoute' }>): void {
  const { labelPosition, waypoints } = command.route;
  if (labelPosition !== undefined
    && (!Number.isFinite(labelPosition) || labelPosition < 0 || labelPosition > 1)) {
    throw new Error(`label-position-off-wire:${labelPosition}`);
  }
  if (waypoints?.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('waypoint-not-a-position');
  }
}

function validateWire(record: DiagramRecord, command: WireCommand): void {
  if (command.kind === 'wire.add') {
    if (record.wires[command.wire.id]) throw new Error(`wire-already-exists:${command.wire.id}`);
    requireWireEndpoint(record, command.wire.source.nodeId);
    requireWireEndpoint(record, command.wire.target.nodeId);
    return;
  }
  if (!record.wires[command.id]) throw new Error(`wire-not-found:${command.id}`);
  if (command.kind === 'wire.reconnect') {
    if (command.source) requireWireEndpoint(record, command.source);
    if (command.target) requireWireEndpoint(record, command.target);
  }
  if (command.kind === 'wire.setRoute') validateRoute(command);
}

function validateInterface(record: DiagramRecord, command: InterfaceCommand): void {
  if (command.kind === 'interface.add') {
    requireNode(record, command.ownerId);
    if (componentFor(record.nodes[command.ownerId].kind).allowsMembers === false) {
      throw new Error(`node-does-not-accept-interfaces:${command.ownerId}`);
    }
    if (record.interfaces[command.iface.id]) {
      throw new Error(`interface-already-exists:${command.iface.id}`);
    }
    requireSignature(command);
    return;
  }
  if (!record.interfaces[command.id]) throw new Error(`interface-not-found:${command.id}`);
  if (command.kind === 'interface.update') requireSignature(command);
}

function validateView(record: DiagramRecord, command: ViewCommand): void {
  if (command.kind !== 'view.setCollapsed') return;
  requireNode(record, command.id);
  if (record.nodes[command.id].kind !== 'group') throw new Error(`not-a-group:${command.id}`);
}

function validateAppearance(record: DiagramRecord, appearanceByNodeId: Record<string, object>): void {
  for (const [nodeId, appearance] of Object.entries(appearanceByNodeId)) {
    requireNode(record, nodeId);
    const allowed = componentFor(record.nodes[nodeId].kind).appearanceKeys ?? [];
    for (const jsonKey of Object.keys(appearance)) {
      const key = appearanceKeyForJsonKey(jsonKey);
      if (!key || !allowed.includes(key)) {
        throw new Error(`appearance-not-supported:${nodeId}:${jsonKey}`);
      }
    }
  }
}

function validateArrangements(
  record: DiagramRecord,
  arrangements: Extract<RecordCommand, { kind: 'layout.presentation.replace' }>['arrangementByContainerId'],
): void {
  for (const [containerId, arrangement] of Object.entries(arrangements)) {
    requireNode(record, containerId);
    const component = componentFor(record.nodes[containerId].kind);
    if (component.layoutRole !== 'container') {
      throw new Error(`arrangement-target-not-container:${containerId}`);
    }
    if (!component.arrangementModes?.includes(arrangement.layout)) {
      throw new Error(`arrangement-mode-not-supported:${containerId}:${arrangement.layout}`);
    }
    const childIds = directChildIds(record, containerId);
    const directChildren = new Set(childIds);
    for (const childId of arrangement.childIds) {
      if (!directChildren.has(childId)) {
        throw new Error(`arrangement-child-not-direct:${containerId}:${childId}`);
      }
    }
    if (arrangement.childIds.length !== childIds.length) {
      throw new Error(`arrangement-must-name-every-direct-child:${containerId}`);
    }
  }
}

function validatePresentation(
  record: DiagramRecord,
  command: Extract<RecordCommand, { kind: 'layout.presentation.replace' }>,
): void {
  layoutPresentationSchema.parse({
    appearanceByNodeId: command.appearanceByNodeId,
    arrangementByContainerId: command.arrangementByContainerId,
  });
  validateAppearance(record, command.appearanceByNodeId);
  validateArrangements(record, command.arrangementByContainerId);
}

function validateOrThrow(record: DiagramRecord, command: RecordCommand): void {
  if (command.kind.startsWith('node.')) return validateNode(record, command as NodeCommand);
  if (command.kind.startsWith('wire.')) return validateWire(record, command as WireCommand);
  if (command.kind.startsWith('interface.')) {
    return validateInterface(record, command as InterfaceCommand);
  }
  if (command.kind.startsWith('view.')) return validateView(record, command as ViewCommand);
  if (command.kind === 'layout.presentation.replace') return validatePresentation(record, command);
  if (command.kind === 'diagram.rename' && command.name.trim().length === 0) {
    throw new Error('diagram-name-empty');
  }
}

/** Validates one command without mutating the supplied record or throwing. */
export function validateRecordCommand(
  record: DiagramRecord,
  command: RecordCommand,
): ValidationResult {
  try {
    validateOrThrow(record, command);
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
