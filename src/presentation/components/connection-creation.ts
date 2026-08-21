import type { Connection, Rect } from '@xyflow/react';
import type { RecordCommand } from '../../application/canvas-workspace.ts';
import { allComponents } from '../../components/registry.ts';
import { asId } from '../../domain/id-cast.ts';
import type { NodeId, WireId } from '../../domain/ids.ts';
import type { PortSide } from '../../domain/records.ts';
import {
  createCanvasNode, type CreatableNodeKind, type PlacedNode, type WorldPoint,
} from '../canvas-actions.ts';
import { NODE_PORTS } from '../../domain/flow.ts';

export interface ConnectionOrigin { nodeId: string; side?: PortSide }

export interface PendingConnection {
  from: ConnectionOrigin;
  world: WorldPoint;
  picker: { x: number; y: number };
}

const OPPOSITE_SIDE: Record<PortSide, PortSide> = {
  top: 'bottom', bottom: 'top', left: 'right', right: 'left',
};

export const connectionCreationEntries = allComponents().flatMap((component) => {
  const creation = component.creation;
  if (!creation || !['shape', 'text'].includes(creation.category)) return [];
  return [{ id: component.kind as CreatableNodeKind, ...creation }];
});

/** Reads a shared port id as the durable routing side it names. */
export function sideOfHandle(handleId: string | null | undefined): PortSide | undefined {
  return NODE_PORTS.includes(handleId as PortSide) ? (handleId as PortSide) : undefined;
}

/** Durable side preference carried by a connect or reconnect gesture, when one was explicit. */
export function wireRouteCommand(
  id: string,
  connection: { sourceHandle?: string | null; targetHandle?: string | null },
): RecordCommand | undefined {
  const preferredSourceSide = sideOfHandle(connection.sourceHandle);
  const preferredTargetSide = sideOfHandle(connection.targetHandle);
  return preferredSourceSide || preferredTargetSide ? {
    kind: 'wire.setRoute', id, route: { preferredSourceSide, preferredTargetSide },
  } : undefined;
}

/** One ordinary port-to-port gesture, including its route, as one undoable change set. */
export function connectedWire(connection: Connection): {
  id: string;
  commands: RecordCommand[];
} | null {
  if (!connection.source || !connection.target) return null;
  const id = `wire-${crypto.randomUUID().slice(0, 8)}`;
  const route = wireRouteCommand(id, connection);
  return {
    id,
    commands: [
      {
        kind: 'wire.add',
        wire: {
          id: asId<WireId>(id), kind: 'references', label: 'connects',
          source: { nodeId: asId<NodeId>(connection.source) },
          target: { nodeId: asId<NodeId>(connection.target) },
        },
      },
      ...(route ? [route] : []),
    ],
  };
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
  surface: Pick<Rect, 'x' | 'y' | 'width' | 'height'>,
): { x: number; y: number } {
  const width = 252;
  const height = 332;
  const margin = 12;
  return {
    x: Math.min(Math.max(point.x - surface.x, margin), Math.max(margin, surface.width - width - margin)),
    y: Math.min(Math.max(point.y - surface.y, margin), Math.max(margin, surface.height - height - margin)),
  };
}
