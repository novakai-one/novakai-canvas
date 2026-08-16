import type { ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignData } from '../../messages-design';

/** One chronologically ordered message and its genuine referenced objects. */
export type OrreryMessage = {
  record: ObjectRecord;
  body: string;
  createdAt: string;
  timeLabel: string;
  sentByPrincipal: boolean;
  references: readonly ObjectRecord[];
};

/** A first-class conversation projection with optional, never inferred Mission context. */
export type OrreryConversation = {
  record: ObjectRecord;
  agent: ObjectRecord | null;
  agentRole: string;
  mission: ObjectRecord | null;
  messages: readonly OrreryMessage[];
  latestAt: string;
  attention: boolean;
  unread: boolean;
};

/** The complete semantic input consumed by Signal Orrery's private geometry. */
export type SignalOrreryModel = {
  conversations: readonly OrreryConversation[];
  entryThreadId: string | null;
};

type ConversationCandidate = OrreryConversation & { containsAttentionSubject: boolean };
type SignalOrrerySource = Pick<
  MessagesDesignData,
  'graph' | 'threads' | 'attentionSubjectId' | 'initialThreadId'
>;

function readableTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function orderedMessages(graph: ObjectGraph, threadId: string): OrreryMessage[] {
  return graph
    .relatedOfKind(threadId, 'contains', 'message')
    .slice()
    .sort((left, right) => field(left, 'createdAt').localeCompare(field(right, 'createdAt')))
    .map((record) => ({
      record,
      body: field(record, 'body') || record.title,
      createdAt: field(record, 'createdAt') || record.createdAt,
      timeLabel: readableTime(field(record, 'createdAt') || record.createdAt),
      sentByPrincipal: field(record, 'senderId') === 'principal_chris',
      references: graph.relatedBy(record.id, 'references'),
    }));
}

function roleForAgent(graph: ObjectGraph, agent: ObjectRecord | null): string {
  if (!agent) return 'Agent conversation';
  const seat = graph.relatedBy(agent.id, 'occupies').find((record) => record.kind === 'teamSeat');
  return seat
    ? graph.relatedBy(seat.id, 'requests').find((record) => record.kind === 'agentRoleProfile')?.title
      ?? 'Agent'
    : 'Agent';
}

function threadIsUnread(graph: ObjectGraph, threadId: string): boolean {
  return graph.byKind('notification').some((notification) => {
    const subjectId = (notification.fields.subjectRef as { id?: string } | undefined)?.id;
    return subjectId === threadId && field(notification, 'status') === 'unread';
  });
}

function containsAttentionSubject(
  thread: ObjectRecord,
  messages: readonly OrreryMessage[],
  attentionSubjectId: string | null,
): boolean {
  if (!attentionSubjectId) return false;
  if (thread.id === attentionSubjectId) return true;
  return messages.some((message) => (
    message.record.id === attentionSubjectId
    || message.references.some((record) => record.id === attentionSubjectId)
  ));
}

function conversationCandidate(
  graph: ObjectGraph,
  thread: ObjectRecord,
  attentionSubjectId: string | null,
): ConversationCandidate {
  const discussedObjects = graph.relatedBy(thread.id, 'discusses');
  const agent = discussedObjects.find((record) => record.kind === 'agent') ?? null;
  const mission = discussedObjects.find((record) => record.kind === 'mission') ?? null;
  const messages = orderedMessages(graph, thread.id);
  const latestAt = messages.at(-1)?.createdAt || field(thread, 'ts') || thread.createdAt;

  return {
    record: thread,
    agent,
    agentRole: roleForAgent(graph, agent),
    mission,
    messages,
    latestAt,
    attention: false,
    unread: threadIsUnread(graph, thread.id),
    containsAttentionSubject: containsAttentionSubject(thread, messages, attentionSubjectId),
  };
}

function sortCandidates(candidates: readonly ConversationCandidate[]): ConversationCandidate[] {
  return candidates.slice().sort((left, right) => {
    if (left.containsAttentionSubject !== right.containsAttentionSubject) {
      return left.containsAttentionSubject ? -1 : 1;
    }
    return right.latestAt.localeCompare(left.latestAt);
  });
}

/** Builds a conversation-first model from the existing Messages public data contract. */
export function buildSignalOrreryModel(data: SignalOrrerySource): SignalOrreryModel {
  const sorted = sortCandidates(
    data.threads.map((thread) => conversationCandidate(data.graph, thread, data.attentionSubjectId)),
  );
  const attentionIndex = sorted.findIndex((conversation) => conversation.containsAttentionSubject);
  const conversations = sorted.map((conversation, index) => ({
    ...conversation,
    attention: index === attentionIndex,
  }));
  const requestedEntry = conversations.find(
    (conversation) => conversation.record.id === data.initialThreadId,
  );

  return {
    conversations,
    entryThreadId: requestedEntry?.record.id ?? conversations[0]?.record.id ?? null,
  };
}
