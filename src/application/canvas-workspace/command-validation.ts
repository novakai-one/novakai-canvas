import { componentFor } from '../../components/registry.ts';
import { signatureFailure } from '../../domain/interface-signature.ts';
import type { CanvasNode, DiagramRecord } from '../../domain/records.ts';
import type { RecordCommand } from './contract.ts';
import { validatePresentation } from './presentation-validation.ts';

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
  if (componentFor(record.nodes[id].kind).identity?.wireAddress === false) {
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

function wireAddressOf(node: CanvasNode): string | undefined {
  const address = componentFor(node.kind).identity?.wireAddress;
  if (typeof address !== 'object') return undefined;
  const value = node[address.field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requireUniqueWireAddress(record: DiagramRecord, node: CanvasNode): void {
  const address = wireAddressOf(node);
  if (!address) return;
  if (Object.values(record.nodes).some((candidate) => wireAddressOf(candidate) === address)) {
    throw new Error(`wire-address-already-exists:${address}`);
  }
}

function validateNode(record: DiagramRecord, command: NodeCommand): void {
  if (command.kind === 'node.add') {
    if (record.nodes[command.node.id]) throw new Error(`node-already-exists:${command.node.id}`);
    if (command.node.parentId) validateParent(record, command.node.id, command.node.parentId);
    requireUniqueWireAddress(record, command.node);
    return;
  }
  requireNode(record, command.id);
  if (command.kind === 'node.update') {
    const node = record.nodes[command.id];
    const identity = componentFor(node.kind).identity;
    const authoredKey = identity?.keyField ? node[identity.keyField] : undefined;
    if (command.patch.label !== undefined && command.patch.label !== node.label
      && identity?.scope === 'parent'
      && (typeof authoredKey !== 'string' || authoredKey.length === 0)) {
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
