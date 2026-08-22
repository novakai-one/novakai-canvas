/** Complete validation and mutation policy for the workspace wire command family. */

import { componentFor } from '../../components/registry.ts';
import type { DiagramRecord, WireRouteHint } from '../../domain/records.ts';
import type { RecordCommand } from './commands.ts';
import { WIRE_CARDINALITIES } from '../../domain/wire-cardinality.ts';

type WireCommand = Extract<RecordCommand, { kind: `wire.${string}` }>;
type Layout = DiagramRecord['layouts'][string];

function requireWireEndpoint(record: DiagramRecord, id: string): void {
  const node = record.nodes[id];
  if (!node) throw new Error(`node-not-found:${id}`);
  if (componentFor(node.kind).identity?.wireAddress === false) {
    throw new Error(`node-not-a-wire-endpoint:${id}`);
  }
}

function validateRoute(command: Extract<WireCommand, { kind: 'wire.setRoute' }>): void {
  const { labelPosition, preferredSourceSide, preferredTargetSide, waypoints } = command.route;
  if (labelPosition !== undefined
    && (!Number.isFinite(labelPosition) || labelPosition < 0 || labelPosition > 1)) {
    throw new Error(`label-position-off-wire:${labelPosition}`);
  }
  if (waypoints?.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('waypoint-not-a-position');
  }
  const sides = ['top', 'right', 'bottom', 'left', null, undefined];
  if (!sides.includes(preferredSourceSide) || !sides.includes(preferredTargetSide)) {
    throw new Error('route-side-not-permitted');
  }
}

/** Rejects an invalid wire command by throwing the existing stable internal reason. */
export function validateWireCommand(record: DiagramRecord, command: WireCommand): void {
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
  if (command.kind === 'wire.setCardinality') {
    for (const value of [command.source, command.target]) {
      if (value !== undefined && value !== null && !WIRE_CARDINALITIES.includes(value)) {
        throw new Error(`wire-cardinality-not-permitted:${value}`);
      }
    }
  }
}

function setWireRoute(
  layout: Layout,
  command: Extract<WireCommand, { kind: 'wire.setRoute' }>,
): void {
  const existing: WireRouteHint = layout.wireRouteHints[command.id]
    ?? { wireId: command.id as never, waypoints: [] };
  const { labelPosition, preferredSourceSide, preferredTargetSide, waypoints } = command.route;
  const next: WireRouteHint = {
    ...existing,
    ...(waypoints ? { waypoints: waypoints.map((point) => ({ ...point })) } : {}),
    ...(labelPosition === undefined ? {} : { labelPosition }),
  };
  if (preferredSourceSide === null) delete next.preferredSourceSide;
  else if (preferredSourceSide !== undefined) next.preferredSourceSide = preferredSourceSide;
  if (preferredTargetSide === null) delete next.preferredTargetSide;
  else if (preferredTargetSide !== undefined) next.preferredTargetSide = preferredTargetSide;
  layout.wireRouteHints[command.id] = next;
}

/** Mutates one cloned record with an already-validated wire command. */
export function applyWireCommand(
  record: DiagramRecord,
  layout: Layout,
  command: WireCommand,
): void {
  switch (command.kind) {
    case 'wire.add': record.wires[command.wire.id] = command.wire; return;
    case 'wire.reconnect': {
      const wire = record.wires[command.id];
      if (command.source) wire.source = { ...wire.source, nodeId: command.source as never };
      if (command.target) wire.target = { ...wire.target, nodeId: command.target as never };
      return;
    }
    case 'wire.setRoute': setWireRoute(layout, command); return;
    case 'wire.setCardinality': {
      const wire = record.wires[command.id];
      if (command.source === null) delete wire.source.cardinality;
      else if (command.source !== undefined) wire.source.cardinality = command.source;
      if (command.target === null) delete wire.target.cardinality;
      else if (command.target !== undefined) wire.target.cardinality = command.target;
      return;
    }
    case 'wire.update': Object.assign(record.wires[command.id], command.patch); return;
    case 'wire.remove':
      delete record.wires[command.id];
      for (const each of Object.values(record.layouts)) {
        delete each.wireRouteHints[command.id];
        if (each.appearanceByWireId) delete each.appearanceByWireId[command.id];
      }
  }
}
