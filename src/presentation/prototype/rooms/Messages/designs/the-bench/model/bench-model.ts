import type { ObjectId, ObjectRecord, RelationType } from '../../../../../object-graph/contract';

/** Stable shared-canvas memory key for The Bench. */
export const BENCH_VIEWPORT_KEY = 'messages:the-bench';

/** The amount of conversation detail visible at the current optical zoom. */
export type BenchZoomTier = 'far' | 'mid' | 'near';

/** Visual mission tone selected from the restrained Bench palette. */
export type BenchMissionTone = 'slate' | 'oxide' | 'moss' | 'violet';

/** One agent participating in a conversation. */
export type BenchParticipant = {
  readonly record: ObjectRecord;
  readonly initials: string;
  readonly status: string;
};

/** Mission context shown without opening a conversation. */
export type BenchMissionContext = {
  readonly record: ObjectRecord;
  readonly tone: BenchMissionTone;
};

/** One typed relationship exposed from a message. */
export type BenchMessageRelation = {
  readonly relation: RelationType;
  readonly label: string;
  readonly record: ObjectRecord;
};

/** One production-shaped message prepared for presentation. */
export type BenchMessage = {
  readonly record: ObjectRecord;
  readonly sender: ObjectRecord | null;
  readonly senderName: string;
  readonly body: string;
  readonly createdAt: string;
  readonly isMine: boolean;
  readonly relations: readonly BenchMessageRelation[];
};

/** One conversation and all context needed by every Bench view state. */
export type BenchConversation = {
  readonly thread: ObjectRecord;
  readonly participants: readonly BenchParticipant[];
  readonly primaryParticipant: BenchParticipant | null;
  readonly mission: BenchMissionContext | null;
  readonly messages: readonly BenchMessage[];
  readonly previewLines: readonly string[];
  readonly unreadCount: number;
  readonly lastActivityAt: string;
  readonly isBlocked: boolean;
  readonly composingAgentName: string | null;
};

/** Read-only relational model built from the Messages host data. */
export type BenchModel = {
  readonly conversations: readonly BenchConversation[];
  readonly conversationsById: ReadonlyMap<ObjectId, BenchConversation>;
  readonly messagesById: ReadonlyMap<ObjectId, BenchMessage>;
  readonly recordsById: ReadonlyMap<ObjectId, ObjectRecord>;
  readonly missions: readonly ObjectRecord[];
  readonly liveAgents: readonly ObjectRecord[];
};

/** Stable identity for one inspection trail. */
export type BenchTrailId = string;

/** Stable identity for one node inside an inspection trail. */
export type BenchTrailStepId = string;

/** A final-form parent-linked step in an inspection trail. */
export type BenchTrailStep = {
  readonly id: BenchTrailStepId;
  readonly kind: 'relations' | 'object';
  readonly parentStepId: BenchTrailStepId | null;
  readonly recordId: ObjectId | null;
  readonly relation: RelationType | null;
};

/** The sideways relationship path rooted at one exact message. */
export type BenchInspectionTrail = {
  readonly id: BenchTrailId;
  readonly threadId: ObjectId;
  readonly rootMessageId: ObjectId;
  readonly steps: readonly BenchTrailStep[];
};

/** A named collection of conversations prepared for the later frame UI. */
export type BenchConversationFrame = {
  readonly id: string;
  readonly name: string;
  readonly conversationIds: readonly ObjectId[];
};

/** Durable identity for the one spatial conversation draft. */
export type BenchPendingDraft = {
  readonly id: string;
};

/** Semantic session state that deliberately excludes canvas placement and zoom. */
export type BenchSessionSnapshot = {
  readonly openThreadIds: readonly ObjectId[];
  readonly trails: readonly BenchInspectionTrail[];
  readonly frames: readonly BenchConversationFrame[];
  readonly scrollTopByThreadId: Readonly<Record<ObjectId, number>>;
  readonly focusedThreadId: ObjectId | null;
  readonly pendingDraft: BenchPendingDraft | null;
};

/** Complete reducer state for The Bench. */
export type BenchState = {
  readonly session: BenchSessionSnapshot;
  readonly zoomTier: BenchZoomTier;
};

/** Every legal semantic state transition owned by the Bench reducer. */
export type BenchAction =
  | { readonly type: 'open-conversation'; readonly threadId: ObjectId }
  | { readonly type: 'collapse-conversation'; readonly threadId: ObjectId }
  | { readonly type: 'inspect-message'; readonly threadId: ObjectId; readonly messageId: ObjectId }
  | {
      readonly type: 'expand-relation';
      readonly trailId: BenchTrailId;
      readonly parentStepId: BenchTrailStepId;
      readonly relation: RelationType;
      readonly recordId: ObjectId;
    }
  | { readonly type: 'close-trail-step'; readonly trailId: BenchTrailId; readonly stepId: BenchTrailStepId }
  | { readonly type: 'remember-scroll'; readonly threadId: ObjectId; readonly scrollTop: number }
  | { readonly type: 'set-zoom-tier'; readonly tier: BenchZoomTier }
  | { readonly type: 'focus-conversation'; readonly threadId: ObjectId }
  | { readonly type: 'clear-focus' }
  | { readonly type: 'create-draft'; readonly draftId: string }
  | { readonly type: 'cancel-draft' }
  | { readonly type: 'accept-draft'; readonly threadId: ObjectId }
  | { readonly type: 'create-frame'; readonly frame: BenchConversationFrame }
  | { readonly type: 'rename-frame'; readonly frameId: string; readonly name: string }
  | { readonly type: 'set-frame-membership'; readonly threadId: ObjectId; readonly frameId: string | null }
  | { readonly type: 'remove-frame'; readonly frameId: string }
  | { readonly type: 'clear-trails' }
  | { readonly type: 'prune-conversation'; readonly threadId: ObjectId }
  | {
      readonly type: 'reconcile-session';
      readonly threadIds: readonly ObjectId[];
      readonly messageIds: readonly ObjectId[];
      readonly recordIds: readonly ObjectId[];
    }
  | { readonly type: 'restore-session'; readonly session: BenchSessionSnapshot };

/** Stable actions supplied to canvas nodes without exposing reducer dispatch. */
export type BenchNodeActions = {
  openConversation(threadId: ObjectId): void;
  collapseConversation(threadId: ObjectId): void;
  inspectMessage(threadId: ObjectId, messageId: ObjectId): void;
  expandRelation(
    trailId: BenchTrailId,
    parentStepId: BenchTrailStepId,
    relation: RelationType,
    recordId: ObjectId,
  ): void;
  closeTrailStep(trailId: BenchTrailId, stepId: BenchTrailStepId): void;
  selectRecord(recordId: ObjectId | null): void;
  canTravel(recordId: ObjectId): boolean;
  travel(recordId: ObjectId): void;
  sendMessage(threadId: ObjectId, body: string): void;
  rememberTranscriptScroll(threadId: ObjectId, scrollTop: number): void;
  markThreadRead(threadId: ObjectId): void;
  attachThreadToMission(threadId: ObjectId, missionId: ObjectId): void;
  archiveConversation(threadId: ObjectId): void;
  renameFrame(frameId: string, name: string): void;
  removeFrame(frameId: string): void;
};

/** Data rendered by the stable conversation canvas node. */
export type ConversationNodeData = Record<string, unknown> & {
  readonly kind: 'conversation';
  readonly selectionId: ObjectId;
  readonly conversation: BenchConversation;
  readonly isOpen: boolean;
  readonly isFocused: boolean;
  readonly tier: BenchZoomTier;
  readonly savedScrollTop: number;
  readonly missions: readonly ObjectRecord[];
  readonly actions: BenchNodeActions;
};

/** Data rendered by the spatial draft node. */
export type DraftConversationNodeData = Record<string, unknown> & {
  readonly kind: 'draft-conversation';
  readonly selectionId: string;
  readonly draft: BenchPendingDraft;
  readonly agents: readonly ObjectRecord[];
  readonly accept: (agent: ObjectRecord) => void;
  readonly cancel: () => void;
};

/** Data rendered by a semantic conversation frame. */
export type ConversationFrameNodeData = Record<string, unknown> & {
  readonly kind: 'conversation-frame';
  readonly selectionId: string;
  readonly frame: BenchConversationFrame;
  readonly actions: BenchNodeActions;
};

/** Data rendered by the first relations node in a trail. */
export type MessageInspectorNodeData = Record<string, unknown> & {
  readonly kind: 'message-inspector';
  readonly selectionId: ObjectId;
  readonly trail: BenchInspectionTrail;
  readonly step: BenchTrailStep;
  readonly message: BenchMessage;
  readonly actions: BenchNodeActions;
};

/** Data rendered by a related-object trail node. */
export type RelatedObjectNodeData = Record<string, unknown> & {
  readonly kind: 'related-object';
  readonly selectionId: ObjectId;
  readonly trail: BenchInspectionTrail;
  readonly step: BenchTrailStep;
  readonly record: ObjectRecord;
  readonly actions: BenchNodeActions;
};

/** Data carried by the custom inspection edge. */
export type InspectionWireData = Record<string, unknown> & {
  readonly trailId: BenchTrailId;
  readonly emphasized: boolean;
};

/** One newly opened node that may require an explicit reveal. */
export type BenchOffscreenCandidate = {
  readonly nodeId: string;
  readonly kind: 'conversation' | 'message-inspector' | 'related-object';
  readonly openedSequence: number;
};
