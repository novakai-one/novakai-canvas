/** Pure command plans for creating and reconnecting Canvas wires. */

import type { RecordCommand } from '@novakai/canvas';
import { NODE_PORTS } from '@novakai/canvas';
import { asId } from '@novakai/canvas';
import type { NodeId, WireId } from '@novakai/canvas';
import type { PortSide } from '@novakai/canvas';
import { portAnchorFromHandle } from '@novakai/canvas';
import {
  createCanvasNode, type CreatableNodeKind, type PlacedNode, type WorldPoint,
} from '../canvas-actions.ts';

/** Framework-independent connection values accepted by the command planners. */
interface ConnectionEnds {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Existing projected edge values needed to calculate the smallest reconnect change. */
interface ExistingConnection extends ConnectionEnds { id: string; source: string; target: string }
/** One node port remembered while a create gesture is active. */
export interface ConnectionOrigin { nodeId: string; side?: PortSide }
/** Empty-canvas drop awaiting the kind of node the user wants to create. */
export interface PendingConnection { from: ConnectionOrigin; world: WorldPoint; picker: WorldPoint }
const OPPOSITE_SIDE: Record<PortSide, PortSide> = {
  top: 'bottom', bottom: 'top', left: 'right', right: 'left',
};

function sameAnchor(
  left: ReturnType<typeof portAnchorFromHandle>,
  right: ReturnType<typeof portAnchorFromHandle>,
): boolean {
  return left?.side === right?.side && left?.ordinal === right?.ordinal;
}

/** Reads a shared port id as the durable routing side it names. */
export function sideOfHandle(handleId: string | null | undefined): PortSide | undefined {
  return NODE_PORTS.includes(handleId as PortSide) ? (handleId as PortSide) : undefined;
}
/** Durable side preference carried by a connect gesture, when one was explicit. */
function wireRouteCommand(
  id: string,
  connection: Pick<ConnectionEnds, 'sourceHandle' | 'targetHandle'>,
): RecordCommand | undefined {
  const preferredSourceSide = sideOfHandle(connection.sourceHandle);
  const preferredTargetSide = sideOfHandle(connection.targetHandle);
  return preferredSourceSide || preferredTargetSide ? {
    kind: 'wire.setRoute', id, route: { preferredSourceSide, preferredTargetSide },
  } : undefined;
}
/** One ordinary port-to-port gesture, including its route, as one undoable change set. */
export function connectedWire(
  connection: ConnectionEnds,
): { id: string; commands: RecordCommand[] } | null {
  if (!connection.source || !connection.target) return null;
  const id = `wire-${crypto.randomUUID().slice(0, 8)}`;
  const route = wireRouteCommand(id, connection);
  const sourceAnchor = portAnchorFromHandle(connection.sourceHandle);
  const targetAnchor = portAnchorFromHandle(connection.targetHandle);
  return {
    id,
    commands: [
      {
        kind: 'wire.add',
        wire: {
          id: asId<WireId>(id), kind: 'references', label: 'connects',
          source: {
            nodeId: asId<NodeId>(connection.source),
            ...(sourceAnchor ? { anchor: sourceAnchor } : {}),
          },
          target: {
            nodeId: asId<NodeId>(connection.target),
            ...(targetAnchor ? { anchor: targetAnchor } : {}),
          },
        },
      },
      ...(route ? [route] : []),
    ],
  };
}
/** Minimal atomic commands for one native endpoint reconnect; exact no-op returns none. */
export function reconnectedWire(
  edge: ExistingConnection,
  connection: ConnectionEnds,
): RecordCommand[] {
  if (!connection.source || !connection.target) return [];
  const sourceChanged = edge.source !== connection.source;
  const targetChanged = edge.target !== connection.target;
  const previousSourceSide = sideOfHandle(edge.sourceHandle);
  const previousTargetSide = sideOfHandle(edge.targetHandle);
  const nextSourceSide = sideOfHandle(connection.sourceHandle);
  const nextTargetSide = sideOfHandle(connection.targetHandle);
  const previousSourceAnchor = portAnchorFromHandle(edge.sourceHandle);
  const previousTargetAnchor = portAnchorFromHandle(edge.targetHandle);
  const nextSourceAnchor = portAnchorFromHandle(connection.sourceHandle);
  const nextTargetAnchor = portAnchorFromHandle(connection.targetHandle);
  const sourceAnchorChanged = !sameAnchor(previousSourceAnchor, nextSourceAnchor);
  const targetAnchorChanged = !sameAnchor(previousTargetAnchor, nextTargetAnchor);
  const sourceSideChanged = previousSourceSide !== nextSourceSide;
  const targetSideChanged = previousTargetSide !== nextTargetSide;
  const commands: RecordCommand[] = [];
  if (sourceChanged || targetChanged || sourceAnchorChanged || targetAnchorChanged) {
    commands.push({
      kind: 'wire.reconnect', id: edge.id,
      ...(sourceChanged ? { source: connection.source } : {}),
      ...(targetChanged ? { target: connection.target } : {}),
      ...(sourceChanged || sourceAnchorChanged ? { sourceAnchor: nextSourceAnchor ?? null } : {}),
      ...(targetChanged || targetAnchorChanged ? { targetAnchor: nextTargetAnchor ?? null } : {}),
    });
  }
  if (sourceChanged || targetChanged || sourceSideChanged || targetSideChanged) {
    commands.push({
      kind: 'wire.setRoute', id: edge.id,
      route: {
        ...(sourceChanged || targetChanged ? { waypoints: [] } : {}),
        ...(sourceSideChanged ? { preferredSourceSide: nextSourceSide ?? null } : {}),
        ...(targetSideChanged ? { preferredTargetSide: nextTargetSide ?? null } : {}),
      },
    });
  }
  return commands;
}
/** Node + wire + route produced by one resolved empty-canvas connection gesture. */
export function connectedNode(
  placed: PlacedNode[],
  pending: PendingConnection,
  kind: CreatableNodeKind,
): { nodeId: string; commands: RecordCommand[] } {
  const nodeId = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
  const created = createCanvasNode(placed, kind, nodeId, pending.world);
  const wireId = `wire-${crypto.randomUUID().slice(0, 8)}`;
  return {
    nodeId,
    commands: [
      { kind: 'node.add', ...created },
      {
        kind: 'wire.add',
        wire: {
          id: asId<WireId>(wireId), kind: 'references', label: 'connects',
          source: { nodeId: asId<NodeId>(pending.from.nodeId) },
          target: { nodeId: created.node.id },
        },
      },
      ...(pending.from.side ? [{
        kind: 'wire.setRoute' as const,
        id: wireId,
        route: {
          preferredSourceSide: pending.from.side,
          preferredTargetSide: OPPOSITE_SIDE[pending.from.side],
        },
      }] : []),
    ],
  };
}
/** Keeps the compact picker inside the visible canvas around the point that opened it. */
export function pickerPosition(
  point: { x: number; y: number },
  surface: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const width = 252;
  const height = 332;
  const margin = 12;
  return {
    x: Math.min(Math.max(point.x - surface.x, margin), Math.max(margin, surface.width - width - margin)),
    y: Math.min(Math.max(point.y - surface.y, margin), Math.max(margin, surface.height - height - margin)),
  };
}
