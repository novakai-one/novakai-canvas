import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { OrreryConversation, OrreryMessage, SignalOrreryModel } from './signal-orrery-model';

export type OrreryZoomTier = 'far' | 'mid' | 'near';
export type OrreryNodeVariant = 'conversation' | 'message' | 'mission' | 'reference';

/** Semantic data rendered by every custom Signal Orrery node. */
export type OrreryNodeData = Record<string, unknown> & {
  variant: OrreryNodeVariant;
  record: ObjectRecord;
  conversation: OrreryConversation;
  message?: OrreryMessage;
  focused: boolean;
  current: boolean;
  dimmed: boolean;
  attention: boolean;
  depth: 'far' | 'mid' | 'near';
  tier: OrreryZoomTier;
  sequence?: number;
};

/** A selectable object in the orbital React Flow projection. */
export type OrreryNode = Node<OrreryNodeData, 'orreryNode'>;

/** Meaning carried by chronology arcs and genuine relationship tethers. */
export type OrreryEdgeData = Record<string, unknown> & {
  kind: 'chronology' | 'context';
  focused: boolean;
  depth: 'far' | 'near';
};

/** A non-selectable connection in the orbital React Flow projection. */
export type OrreryEdge = Edge<OrreryEdgeData, 'orreryEdge'>;

/** Ephemeral view choices applied to the deterministic semantic geometry. */
export type OrreryProjectionState = {
  activeThreadId: string | null;
  selectedId: string | null;
  overview: boolean;
  tier: OrreryZoomTier;
  movedPositions: ReadonlyMap<string, { x: number; y: number }>;
};

/** The nodes, connections and camera targets required by the scene. */
export type OrreryProjection = {
  nodes: OrreryNode[];
  edges: OrreryEdge[];
  overviewNodeIds: string[];
  focusedNodeId: string | null;
};

const HERO_CENTER = { x: 520, y: 420 };
const HERO_CORE_SIZE = 104;
const MESSAGE_WIDTH = 176;
const MESSAGE_HEIGHT = 78;
const PERIPHERAL_WIDTH = 176;
const PERIPHERAL_HEIGHT = 116;

function overviewPosition(index: number, count: number): { x: number; y: number } {
  if (count <= 1) return { x: HERO_CENTER.x - 88, y: HERO_CENTER.y - 58 };
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return {
    x: HERO_CENTER.x + Math.cos(angle) * 650 - PERIPHERAL_WIDTH / 2,
    y: HERO_CENTER.y + Math.sin(angle) * 350 - PERIPHERAL_HEIGHT / 2,
  };
}

function conversationNode(
  conversation: OrreryConversation,
  index: number,
  count: number,
  state: OrreryProjectionState,
): OrreryNode {
  const focused = !state.overview && conversation.record.id === state.activeThreadId;
  const naturalPosition = focused
    ? { x: HERO_CENTER.x - HERO_CORE_SIZE / 2, y: HERO_CENTER.y - HERO_CORE_SIZE / 2 }
    : overviewPosition(index, count);
  const position = state.movedPositions.get(conversation.record.id) ?? naturalPosition;
  const width = focused ? HERO_CORE_SIZE : PERIPHERAL_WIDTH;
  const height = focused ? HERO_CORE_SIZE : PERIPHERAL_HEIGHT;

  return {
    id: conversation.record.id,
    type: 'orreryNode',
    position,
    data: {
      variant: 'conversation',
      record: conversation.record,
      conversation,
      focused,
      current: conversation.record.id === state.activeThreadId,
      dimmed: !state.overview && !focused,
      attention: conversation.attention,
      depth: focused ? 'near' : 'far',
      tier: state.tier,
    },
    style: { width, height },
    draggable: !focused,
    selectable: true,
    focusable: true,
    zIndex: focused ? 20 : 4,
  };
}

function messageAngle(index: number, count: number): number {
  const progress = count <= 1 ? 1 : index / (count - 1);
  return (140 + progress * 130) * (Math.PI / 180);
}

function messagePosition(angle: number): { x: number; y: number } {
  return {
    x: HERO_CENTER.x + Math.cos(angle) * 310 - MESSAGE_WIDTH / 2,
    y: HERO_CENTER.y + Math.sin(angle) * 205 - MESSAGE_HEIGHT / 2,
  };
}

function messageNode(
  conversation: OrreryConversation,
  message: OrreryMessage,
  index: number,
  state: OrreryProjectionState,
): OrreryNode {
  const angle = messageAngle(index, conversation.messages.length);
  const y = HERO_CENTER.y + Math.sin(angle) * 205;
  return {
    id: message.record.id,
    type: 'orreryNode',
    position: messagePosition(angle),
    data: {
      variant: 'message',
      record: message.record,
      conversation,
      message,
      focused: true,
      current: false,
      dimmed: false,
      attention: false,
      depth: y > HERO_CENTER.y ? 'near' : 'far',
      tier: state.tier,
      sequence: index + 1,
    },
    style: { width: MESSAGE_WIDTH, height: MESSAGE_HEIGHT },
    draggable: false,
    selectable: true,
    focusable: true,
    zIndex: state.selectedId === message.record.id ? 32 : y > HERO_CENTER.y ? 18 : 12,
  };
}

function contextNode(
  variant: 'mission' | 'reference',
  record: ObjectRecord,
  conversation: OrreryConversation,
  position: { x: number; y: number },
  state: OrreryProjectionState,
  message?: OrreryMessage,
): OrreryNode {
  return {
    id: `${variant}:${message?.record.id ?? conversation.record.id}:${record.id}`,
    type: 'orreryNode',
    position,
    data: {
      variant,
      record,
      conversation,
      message,
      focused: true,
      current: false,
      dimmed: false,
      attention: false,
      depth: 'near',
      tier: state.tier,
    },
    style: { width: variant === 'mission' ? 156 : 144, height: variant === 'mission' ? 74 : 66 },
    draggable: false,
    selectable: true,
    focusable: true,
    zIndex: state.selectedId === record.id ? 34 : 22,
  };
}

function chronologyEdges(conversation: OrreryConversation): OrreryEdge[] {
  return conversation.messages.slice(1).map((message, index) => ({
    id: `chronology:${conversation.messages[index].record.id}:${message.record.id}`,
    source: conversation.messages[index].record.id,
    target: message.record.id,
    type: 'orreryEdge',
    data: { kind: 'chronology', focused: true, depth: index < conversation.messages.length / 2 ? 'far' : 'near' },
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#858D96' },
    selectable: false,
    focusable: false,
    zIndex: 7,
  }));
}

function selectedSourceMessage(
  conversation: OrreryConversation,
  selectedId: string | null,
): OrreryMessage | null {
  if (!selectedId) return null;
  return conversation.messages.find((message) => (
    message.record.id === selectedId
    || message.references.some((reference) => reference.id === selectedId)
  )) ?? null;
}

function addMissionContext(
  nodes: OrreryNode[],
  edges: OrreryEdge[],
  conversation: OrreryConversation,
  state: OrreryProjectionState,
): void {
  if (!conversation.mission) return;
  const node = contextNode(
    'mission',
    conversation.mission,
    conversation,
    { x: HERO_CENTER.x - 440, y: HERO_CENTER.y - 245 },
    state,
  );
  nodes.push(node);
  edges.push({
    id: `context:${conversation.record.id}:${conversation.mission.id}`,
    source: conversation.record.id,
    target: node.id,
    type: 'orreryEdge',
    data: { kind: 'context', focused: true, depth: 'far' },
    selectable: false,
    focusable: false,
    zIndex: 5,
  });
}

function addSelectedReferences(
  nodes: OrreryNode[],
  edges: OrreryEdge[],
  conversation: OrreryConversation,
  state: OrreryProjectionState,
): void {
  const source = selectedSourceMessage(conversation, state.selectedId);
  if (!source) return;
  const sourceIndex = conversation.messages.findIndex((message) => message.record.id === source.record.id);
  const angle = messageAngle(sourceIndex, conversation.messages.length);

  source.references.slice(0, 5).forEach((record, index) => {
    const fanAngle = angle + (index - (source.references.length - 1) / 2) * 0.18;
    const node = contextNode(
      'reference',
      record,
      conversation,
      {
        x: HERO_CENTER.x + Math.cos(fanAngle) * 470 - 72,
        y: HERO_CENTER.y + Math.sin(fanAngle) * 310 - 33,
      },
      state,
      source,
    );
    nodes.push(node);
    edges.push({
      id: `reference:${source.record.id}:${record.id}`,
      source: source.record.id,
      target: node.id,
      type: 'orreryEdge',
      data: { kind: 'context', focused: true, depth: 'near' },
      selectable: false,
      focusable: false,
      zIndex: 9,
    });
  });
}

/** Projects semantic conversation state into restrained, selectable orbital geometry. */
export function buildSignalOrreryProjection(
  model: SignalOrreryModel,
  state: OrreryProjectionState,
): OrreryProjection {
  const nodes = model.conversations.map((conversation, index) => (
    conversationNode(conversation, index, model.conversations.length, state)
  ));
  const active = state.overview
    ? null
    : model.conversations.find((conversation) => conversation.record.id === state.activeThreadId) ?? null;
  const edges: OrreryEdge[] = [];

  if (active) {
    nodes.push(...active.messages.map((message, index) => messageNode(active, message, index, state)));
    edges.push(...chronologyEdges(active));
    addMissionContext(nodes, edges, active, state);
    addSelectedReferences(nodes, edges, active, state);
  }

  return {
    nodes,
    edges,
    overviewNodeIds: model.conversations.map((conversation) => conversation.record.id),
    focusedNodeId: active?.record.id ?? null,
  };
}
