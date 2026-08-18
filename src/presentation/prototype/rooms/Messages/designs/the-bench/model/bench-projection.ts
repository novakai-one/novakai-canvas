import type { Edge, Node } from '@xyflow/react';
import { relationsFor } from '../../../../../components/InspectorPanel/inspector-content';
import { KIND_LABEL, RELATION_LABEL, type ObjectRecord, type Related } from '../../../../../object-graph/contract';
import { field } from '../../../../../object-graph/graph';
import type { WorldPoint } from '../../../../../components/canvas/WorldCanvas';
import type { MessagesDesignData } from '../../../messages-design';
import {
  BENCH_CARD_SIZE,
  BENCH_INSPECTOR_SIZE,
  BENCH_THREAD_SIZE,
  conversationPoint,
  layoutInspectionTrail,
  placementMapOf,
  type BenchPlacement,
} from './bench-layout';
import type {
  BenchConversation,
  BenchMessage,
  BenchMessageRelation,
  BenchMissionTone,
  BenchModel,
  BenchNodeActions,
  BenchParticipant,
  BenchState,
  BenchInspectionTrail,
  BenchTrailStep,
  ConversationNodeData,
  InspectionWireData,
  MessageInspectorNodeData,
  RelatedObjectNodeData,
} from './bench-model';

const RECENT_CONVERSATION_LIMIT = 8;
const MISSION_TONES: readonly BenchMissionTone[] = ['slate', 'oxide', 'moss', 'violet'];

/** Typed React Flow node union produced only at the projection seam. */
export type BenchConversationCanvasNode = Node<ConversationNodeData, 'bench-conversation'>;

/** Typed message-inspector node at the projection seam. */
export type BenchMessageInspectorCanvasNode = Node<MessageInspectorNodeData, 'bench-message-inspector'>;

/** Typed related-object node at the projection seam. */
export type BenchRelatedObjectCanvasNode = Node<RelatedObjectNodeData, 'bench-related-object'>;

/** Union of every node The Bench supplies to the shared canvas. */
export type BenchCanvasNode =
  | BenchConversationCanvasNode
  | BenchMessageInspectorCanvasNode
  | BenchRelatedObjectCanvasNode;

/** Typed React Flow edge produced only at the projection seam. */
export type BenchCanvasEdge = Edge<InspectionWireData, 'bench-inspection'>;

/** Complete read-only canvas projection consumed by TheBench. */
export type BenchCanvasProjection = {
  readonly nodes: readonly BenchCanvasNode[];
  readonly edges: readonly BenchCanvasEdge[];
};

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function missionToneFor(id: string): BenchMissionTone {
  const value = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return MISSION_TONES[value % MISSION_TONES.length];
}

function participantFor(record: ObjectRecord): BenchParticipant {
  return {
    record,
    initials: initialsFor(record.title) || 'A',
    status: field(record, 'status'),
  };
}

function orderedRelations(related: readonly Related[]): BenchMessageRelation[] {
  const preferredOrder = relationsFor('message');
  return related
    .slice()
    .sort((left, right) => (
      preferredOrder.indexOf(left.relation) - preferredOrder.indexOf(right.relation)
    ))
    .map((entry) => ({
      relation: entry.relation,
      label: RELATION_LABEL[entry.relation] ?? KIND_LABEL[entry.record.kind],
      record: entry.record,
    }));
}

function messageFor(data: MessagesDesignData, record: ObjectRecord): BenchMessage {
  const senderId = field(record, 'senderId');
  const sender = senderId ? data.graph.get(senderId) ?? null : null;
  return {
    record,
    sender,
    senderName: sender?.title ?? 'Unknown sender',
    body: field(record, 'body') || record.title,
    createdAt: field(record, 'createdAt') || record.createdAt,
    isMine: senderId === 'principal_chris',
    relations: orderedRelations(data.graph.related(record.id)),
  };
}

function isConversationBlocked(conversation: {
  participants: readonly BenchParticipant[];
  messages: readonly BenchMessage[];
}): boolean {
  if (conversation.participants.some((participant) => participant.status === 'failed')) return true;
  return conversation.messages.some((message) => message.relations.some((relation) => (
    field(relation.record, 'status') === 'blocked'
  )));
}

function conversationFor(data: MessagesDesignData, thread: ObjectRecord): BenchConversation {
  const participants = data.graph.relatedOfKind(thread.id, 'discusses', 'agent').map(participantFor);
  const mission = data.graph.relatedOfKind(thread.id, 'discusses', 'mission')[0] ?? null;
  const messages = data.graph
    .relatedOfKind(thread.id, 'contains', 'message')
    .map((record) => messageFor(data, record))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const notifications = data.graph.relatedOfKind(thread.id, 'notified', 'notification');
  const composingParticipant = participants.find((participant) => (
    participant.record.fields.composing === true
  ));
  const conversationBase = { participants, messages };

  return {
    thread,
    participants,
    primaryParticipant: participants[0] ?? null,
    mission: mission ? { record: mission, tone: missionToneFor(mission.id) } : null,
    messages,
    previewLines: messages.slice(-2).map((message) => message.body),
    unreadCount: notifications.filter((record) => field(record, 'status') === 'unread').length,
    lastActivityAt: messages.at(-1)?.createdAt ?? thread.createdAt,
    isBlocked: isConversationBlocked(conversationBase),
    composingAgentName: composingParticipant?.record.title ?? null,
  };
}

function recentConversations(
  conversations: readonly BenchConversation[],
  initialThreadId?: string,
): BenchConversation[] {
  const sorted = conversations
    .slice()
    .sort((left, right) => (
      right.lastActivityAt.localeCompare(left.lastActivityAt)
      || left.thread.id.localeCompare(right.thread.id)
    ));
  const recent = sorted.slice(0, RECENT_CONVERSATION_LIMIT);
  const routed = initialThreadId
    ? conversations.find((conversation) => conversation.thread.id === initialThreadId)
    : undefined;
  if (!routed || recent.some((conversation) => conversation.thread.id === routed.thread.id)) return recent;
  return [...recent.slice(0, RECENT_CONVERSATION_LIMIT - 1), routed];
}

/** Builds the immutable Bench model from the host's normalized relational graph. */
export function buildBenchModel(data: MessagesDesignData): BenchModel {
  const conversations = recentConversations(
    data.threads.map((thread) => conversationFor(data, thread)),
    data.initialThreadId,
  );
  return {
    conversations,
    conversationsById: new Map(conversations.map((conversation) => [conversation.thread.id, conversation])),
    messagesById: new Map(conversations.flatMap((conversation) => (
      conversation.messages.map((message) => [message.record.id, message] as const)
    ))),
    recordsById: new Map(data.graph.all.map((record) => [record.id, record])),
  };
}

function conversationNodes(
  model: BenchModel,
  state: BenchState,
  placements: readonly BenchPlacement[],
  actions: BenchNodeActions,
): BenchCanvasNode[] {
  const placementMap = placementMapOf(placements);
  return model.conversations.map((conversation, index) => {
    const isOpen = state.session.openThreadIds.includes(conversation.thread.id);
    const size = isOpen ? BENCH_THREAD_SIZE : BENCH_CARD_SIZE;
    return {
      id: conversation.thread.id,
      type: 'bench-conversation',
      position: conversationPoint(conversation.thread.id, index, placementMap),
      data: {
        kind: 'conversation',
        selectionId: conversation.thread.id,
        conversation,
        isOpen,
        isFocused: state.session.focusedThreadId === conversation.thread.id,
        tier: state.zoomTier,
        savedScrollTop: state.session.scrollTopByThreadId[conversation.thread.id] ?? 0,
        actions,
      },
      style: { width: size.width, height: size.height },
      zIndex: isOpen ? 20 : 10,
    };
  });
}

type TrailStepProjectionInput = {
  readonly trail: BenchInspectionTrail;
  readonly step: BenchTrailStep;
  readonly position: WorldPoint;
  readonly message: BenchMessage;
  readonly model: BenchModel;
  readonly actions: BenchNodeActions;
};

function relationInspectorProjection({
  trail,
  step,
  position,
  message,
  actions,
}: TrailStepProjectionInput): BenchCanvasProjection {
  return {
    nodes: [{
      id: step.id,
      type: 'bench-message-inspector',
      position,
      data: { kind: 'message-inspector', selectionId: message.record.id, trail, step, message, actions },
      style: { width: BENCH_INSPECTOR_SIZE.width },
      zIndex: 1200,
    }],
    edges: [{
      id: `wire:${trail.id}:${step.id}`,
      type: 'bench-inspection',
      source: trail.threadId,
      sourceHandle: `message:${trail.rootMessageId}:inspect`,
      target: step.id,
      targetHandle: 'trail-target',
      data: { trailId: trail.id, emphasized: true },
    }],
  };
}

function relatedObjectProjection(input: TrailStepProjectionInput): BenchCanvasProjection {
  const { trail, step, position, model, actions } = input;
  const record = step.recordId ? model.recordsById.get(step.recordId) : undefined;
  if (!record || !step.parentStepId) return { nodes: [], edges: [] };

  return {
    nodes: [{
      id: step.id,
      type: 'bench-related-object',
      position,
      data: { kind: 'related-object', selectionId: record.id, trail, step, record, actions },
      style: { width: BENCH_INSPECTOR_SIZE.width },
      zIndex: 1190,
    }],
    edges: [{
      id: `wire:${trail.id}:${step.id}`,
      type: 'bench-inspection',
      source: step.parentStepId,
      sourceHandle: `relation:${step.relation}:${record.id}`,
      target: step.id,
      targetHandle: 'trail-target',
      data: { trailId: trail.id, emphasized: false },
    }],
  };
}

function appendProjection(
  target: { nodes: BenchCanvasNode[]; edges: BenchCanvasEdge[] },
  addition: BenchCanvasProjection,
): void {
  target.nodes.push(...addition.nodes);
  target.edges.push(...addition.edges);
}

function trailProjection(
  model: BenchModel,
  state: BenchState,
  placements: readonly BenchPlacement[],
  actions: BenchNodeActions,
): BenchCanvasProjection {
  const nodes: BenchCanvasNode[] = [];
  const edges: BenchCanvasEdge[] = [];
  const placementMap = placementMapOf(placements);

  state.session.trails.forEach((trail, trailIndex) => {
    const conversationIndex = model.conversations.findIndex((item) => item.thread.id === trail.threadId);
    const message = model.messagesById.get(trail.rootMessageId);
    if (conversationIndex < 0 || !message) return;
    const conversationPosition = conversationPoint(trail.threadId, conversationIndex, placementMap);
    const layout = layoutInspectionTrail(trail, state, conversationPosition, trailIndex);

    for (const step of trail.steps) {
      const position = placementMap.get(step.id)?.position ?? layout.get(step.id);
      if (!position) continue;
      const input = { trail, step, position, message, model, actions };
      appendProjection(
        { nodes, edges },
        step.kind === 'relations'
          ? relationInspectorProjection(input)
          : relatedObjectProjection(input),
      );
    }
  });
  return { nodes, edges };
}

/** Purely projects Bench state and neutral placement snapshots into canvas records. */
export function projectBenchCanvas(
  model: BenchModel,
  state: BenchState,
  placements: readonly BenchPlacement[],
  actions: BenchNodeActions,
): BenchCanvasProjection {
  const conversations = conversationNodes(model, state, placements, actions);
  const trails = trailProjection(model, state, placements, actions);
  return { nodes: [...conversations, ...trails.nodes], edges: trails.edges };
}
