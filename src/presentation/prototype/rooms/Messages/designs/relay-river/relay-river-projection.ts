import type { Edge, Node } from '@xyflow/react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { RelayRiverModel, RiverThread } from './relay-river-model';

/** The two semantic detail levels supported by Relay River. */
export type RelayRiverTier = 'overview' | 'reading';

type RiverVariant = 'headwater' | 'message' | 'now' | 'tributary' | 'empty';

type RiverLandmarkData = Record<string, unknown> & {
  readonly record: ObjectRecord;
  readonly variant: RiverVariant;
  readonly tier: RelayRiverTier;
  readonly mine: boolean;
  readonly agentName: string;
  readonly agentRole: string;
  readonly missionTitle: string;
  readonly body: string;
  readonly meta: string;
  readonly references: readonly ObjectRecord[];
  readonly unresolved: boolean;
  readonly onInspectReference: (record: ObjectRecord, sourceNodeId: string) => void;
  readonly canOpen: (record: ObjectRecord) => boolean;
  readonly open: (record: ObjectRecord) => void;
};

type RiverCurrentData = Record<string, unknown> & {
  readonly reachesNow: boolean;
};

/** A fixed semantic landmark on the Relay River canvas. */
export type RiverNode = Node<RiverLandmarkData, 'riverLandmark'>;

/** A chronological segment of the active conversation current. */
export type RiverEdge = Edge<RiverCurrentData, 'riverCurrent'>;

type ProjectionActions = {
  onInspectReference(record: ObjectRecord, sourceNodeId: string): void;
  canOpen(record: ObjectRecord): boolean;
  open(record: ObjectRecord): void;
};

const MESSAGE_WIDTH = 292;
const HEADWATER_WIDTH = 420;
const NOW_WIDTH = 500;

function formattedTime(record: ObjectRecord): string {
  const parsed = new Date(field(record, 'createdAt'));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

function nodeData(
  thread: RiverThread,
  record: ObjectRecord,
  variant: RiverVariant,
  tier: RelayRiverTier,
  actions: ProjectionActions,
): RiverLandmarkData {
  const latestMessage = thread.messages.at(-1)?.record;
  const body = variant === 'tributary' && latestMessage
    ? field(latestMessage, 'body') || latestMessage.title
    : field(record, 'body') || field(record, 'question') || record.title;
  return {
    record,
    variant,
    tier,
    mine: field(record, 'senderId') === 'principal_chris',
    agentName: thread.agent?.title ?? 'Conversation',
    agentRole: thread.agentRole,
    missionTitle: thread.mission?.title ?? 'No Mission attached',
    body,
    meta: formattedTime(record),
    references: record.kind === 'message'
      ? thread.messages.find((message) => message.record.id === record.id)?.references ?? []
      : [],
    unresolved: thread.now?.record.id === record.id && thread.now.unresolved,
    ...actions,
  };
}

function overviewNodes(
  thread: RiverThread,
  tier: RelayRiverTier,
  actions: ProjectionActions,
): RiverNode[] {
  const nodes = [headwaterNode(thread, tier, actions)];
  const now = thread.now;
  if (now) {
    nodes.push({
      id: now.record.id,
      type: 'riverLandmark',
      position: { x: 46, y: 210 },
      data: nodeData(thread, now.record, 'now', tier, actions),
      style: { width: NOW_WIDTH },
      draggable: false,
      zIndex: 12,
    });
  } else {
    nodes.push({
      id: `river-empty:${thread.record.id}`,
      type: 'riverLandmark',
      position: { x: 82, y: 224 },
      data: nodeData(thread, thread.record, 'empty', tier, actions),
      style: { width: 428 },
      draggable: false,
      zIndex: 8,
    });
  }
  return nodes;
}

function estimatedMessageHeight(message: RiverThread['messages'][number]): number {
  const body = field(message.record, 'body') || message.record.title;
  const textLines = Math.max(1, Math.ceil(body.length / 48));
  return 112 + textLines * 24 + message.references.length * 38;
}

function headwaterNode(
  thread: RiverThread,
  tier: RelayRiverTier,
  actions: ProjectionActions,
): RiverNode {
  const record = thread.mission ?? thread.record;
  return {
    id: `river-headwater:${thread.record.id}`,
    type: 'riverLandmark',
    position: { x: 86, y: 0 },
    data: nodeData(thread, record, 'headwater', tier, actions),
    style: { width: HEADWATER_WIDTH },
    draggable: false,
    zIndex: 6,
  };
}

function readingNodes(
  thread: RiverThread,
  tier: RelayRiverTier,
  actions: ProjectionActions,
): RiverNode[] {
  const nodes: RiverNode[] = [headwaterNode(thread, tier, actions)];
  let nextY = 190;

  for (const message of thread.messages) {
    const isNow = thread.now?.record.id === message.record.id;
    const timeGap = Math.min(54, message.minutesAfterPrevious * 2);
    nextY += timeGap;
    nodes.push({
      id: message.record.id,
      type: 'riverLandmark',
      position: { x: isNow ? 46 : message.mine ? 314 : 0, y: nextY },
      data: nodeData(thread, message.record, isNow ? 'now' : 'message', tier, actions),
      style: { width: isNow ? NOW_WIDTH : MESSAGE_WIDTH },
      draggable: false,
      zIndex: isNow ? 12 : 8,
    });
    nextY += estimatedMessageHeight(message) + 66;
  }

  if (thread.now && thread.now.record.kind !== 'message') {
    nodes.push({
      id: thread.now.record.id,
      type: 'riverLandmark',
      position: { x: 46, y: nextY + 24 },
      data: nodeData(thread, thread.now.record, 'now', tier, actions),
      style: { width: NOW_WIDTH },
      draggable: false,
      zIndex: 12,
    });
  } else if (thread.messages.length === 0) {
    nodes.push({
      id: `river-empty:${thread.record.id}`,
      type: 'riverLandmark',
      position: { x: 82, y: 224 },
      data: nodeData(thread, thread.record, 'empty', tier, actions),
      style: { width: 428 },
      draggable: false,
      zIndex: 8,
    });
  }
  return nodes;
}

function tributaryNodes(
  model: RelayRiverModel,
  activeThreadId: string,
  tier: RelayRiverTier,
  actions: ProjectionActions,
): RiverNode[] {
  if (tier !== 'overview') return [];
  return model.threads
    .filter((thread) => thread.record.id !== activeThreadId)
    .map((thread, index) => ({
      id: `river-tributary:${thread.record.id}`,
      type: 'riverLandmark' as const,
      position: {
        x: index % 2 === 0 ? -410 : 650,
        y: 80 + Math.floor(index / 2) * 180,
      },
      data: nodeData(thread, thread.record, 'tributary', tier, actions),
      style: { width: 286 },
      draggable: false,
      zIndex: 2,
    }));
}

function chronologicalEdges(thread: RiverThread, tier: RelayRiverTier): RiverEdge[] {
  if (tier === 'overview') return [];
  const ids = thread.messages.map((message) => message.record.id);
  if (thread.now && thread.now.record.kind !== 'message') ids.push(thread.now.record.id);
  return ids.slice(1).map((target, index) => ({
    id: `river-current:${ids[index]}:${target}`,
    source: ids[index],
    target,
    type: 'riverCurrent',
    data: { reachesNow: target === thread.now?.record.id },
    selectable: false,
    focusable: false,
    zIndex: 3,
  }));
}

/** Projects one active conversation and a reduced overview into canvas primitives. */
export function projectRelayRiver(
  model: RelayRiverModel,
  activeThreadId: string,
  tier: RelayRiverTier,
  actions: ProjectionActions,
): { nodes: RiverNode[]; edges: RiverEdge[]; focusNodeId: string | null } {
  const active = model.threads.find((thread) => thread.record.id === activeThreadId);
  if (!active) return { nodes: [], edges: [], focusNodeId: null };
  const nodes = [
    ...(tier === 'overview'
      ? overviewNodes(active, tier, actions)
      : readingNodes(active, tier, actions)),
    ...tributaryNodes(model, activeThreadId, tier, actions),
  ];
  return {
    nodes,
    edges: chronologicalEdges(active, tier),
    focusNodeId: active.now?.record.id
      ?? active.messages.at(-1)?.record.id
      ?? `river-empty:${active.record.id}`,
  };
}
