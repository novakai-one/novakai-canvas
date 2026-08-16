import type { ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';

type RiverMessage = {
  readonly record: ObjectRecord;
  readonly mine: boolean;
  readonly references: readonly ObjectRecord[];
  readonly minutesAfterPrevious: number;
};

type RiverNow = {
  readonly record: ObjectRecord;
  readonly sourceMessageId: string;
  readonly unresolved: boolean;
};

/** One conversation with the context Relay River needs to render it. */
export type RiverThread = {
  readonly record: ObjectRecord;
  readonly agent: ObjectRecord | null;
  readonly agentRole: string;
  readonly mission: ObjectRecord | null;
  readonly messages: readonly RiverMessage[];
  readonly now: RiverNow | null;
  readonly unread: boolean;
};

/** The complete read-only projection consumed by the Relay River view. */
export type RelayRiverModel = {
  readonly threads: readonly RiverThread[];
  readonly agents: readonly {
    readonly record: ObjectRecord;
    readonly role: string;
  }[];
  readonly entryThreadId: string | null;
};

function roleOf(graph: ObjectGraph, agent: ObjectRecord | null): string {
  if (!agent) return 'Unseated';
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  return seat ? graph.relatedBy(seat.id, 'requests')[0]?.title ?? 'Unseated' : 'Unseated';
}

function sortedMessages(graph: ObjectGraph, threadId: string): ObjectRecord[] {
  return graph
    .relatedOfKind(threadId, 'contains', 'message')
    .slice()
    .sort((left, right) => field(left, 'createdAt').localeCompare(field(right, 'createdAt')));
}

function minutesBetween(previous: ObjectRecord | undefined, current: ObjectRecord): number {
  if (!previous) return 0;
  const previousTime = Date.parse(field(previous, 'createdAt'));
  const currentTime = Date.parse(field(current, 'createdAt'));
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return 0;
  return Math.max(0, Math.round((currentTime - previousTime) / 60_000));
}

function hasUnreadNotification(graph: ObjectGraph, threadId: string): boolean {
  return graph.byKind('notification').some((notification) => {
    const subject = notification.fields.subjectRef as { id?: string } | undefined;
    return subject?.id === threadId && field(notification, 'status') === 'unread';
  });
}

function isUnresolved(record: ObjectRecord): boolean {
  const status = field(record, 'status');
  if (record.kind === 'request') return status === 'pending' || status === '';
  return ['open', 'blocked', 'failed', 'paused'].includes(status);
}

function attentionSource(
  messages: readonly RiverMessage[],
  attentionSubjectId: string | null,
): RiverNow | null {
  if (!attentionSubjectId) return null;

  for (const message of messages) {
    if (message.record.id === attentionSubjectId) {
      return { record: message.record, sourceMessageId: message.record.id, unresolved: true };
    }
    const referenced = message.references.find((record) => record.id === attentionSubjectId);
    if (referenced) {
      return { record: referenced, sourceMessageId: message.record.id, unresolved: true };
    }
  }
  return null;
}

function pendingReference(messages: readonly RiverMessage[]): RiverNow | null {
  for (const message of messages.slice().reverse()) {
    const record = message.references.find(isUnresolved);
    if (record) return { record, sourceMessageId: message.record.id, unresolved: true };
  }
  return null;
}

function latestTurn(messages: readonly RiverMessage[]): RiverNow | null {
  const latest = messages.at(-1);
  if (!latest) return null;
  return {
    record: latest.record,
    sourceMessageId: latest.record.id,
    unresolved: !latest.mine,
  };
}

function projectThread(
  graph: ObjectGraph,
  thread: ObjectRecord,
  attentionSubjectId: string | null,
): RiverThread {
  const records = sortedMessages(graph, thread.id);
  const messages = records.map((record, index) => ({
    record,
    mine: field(record, 'senderId') === 'principal_chris',
    references: graph.relatedBy(record.id, 'references'),
    minutesAfterPrevious: minutesBetween(records[index - 1], record),
  }));
  const discussed = graph.relatedBy(thread.id, 'discusses');
  const agent = discussed.find((record) => record.kind === 'agent') ?? null;

  return {
    record: thread,
    agent,
    agentRole: roleOf(graph, agent),
    mission: discussed.find((record) => record.kind === 'mission') ?? null,
    messages,
    now: attentionSource(messages, attentionSubjectId) ?? pendingReference(messages) ?? latestTurn(messages),
    unread: hasUnreadNotification(graph, thread.id),
  };
}

function entryThreadId(
  threads: readonly RiverThread[],
  attentionSubjectId: string | null,
): string | null {
  const attentive = threads.find((thread) => (
    thread.record.id === attentionSubjectId || thread.now?.record.id === attentionSubjectId
  ));
  return attentive?.record.id ?? threads.find((thread) => thread.unread)?.record.id ?? threads[0]?.record.id ?? null;
}

/** Builds Relay River's semantic model without owning or mutating any graph fact. */
export function buildRelayRiverModel(
  graph: ObjectGraph,
  threads: readonly ObjectRecord[],
  liveAgents: readonly ObjectRecord[],
  attentionSubjectId: string | null,
): RelayRiverModel {
  const projectedThreads = threads.map((thread) => projectThread(graph, thread, attentionSubjectId));
  return {
    threads: projectedThreads,
    agents: liveAgents.map((record) => ({ record, role: roleOf(graph, record) })),
    entryThreadId: entryThreadId(projectedThreads, attentionSubjectId),
  };
}
