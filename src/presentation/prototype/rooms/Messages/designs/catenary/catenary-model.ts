/**
 * Catenary's semantic model: conversations read as cables under load.
 *
 * A cable is strung between an Agent anchor and your anchor. That pair is the whole
 * conversation — a Mission is attached only when the thread genuinely discusses one,
 * and a thread without one is complete, not incomplete.
 */
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';

const PRINCIPAL_ID = 'principal_chris';
const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECONDS_PER_MINUTE = 60_000;
const UNRESOLVED_STATUSES = ['open', 'blocked', 'failed', 'paused', 'pending'];

/** One turn on a cable, with the gap that separates it from the turn before. */
export type CableMessage = {
  readonly record: ObjectRecord;
  readonly mine: boolean;
  readonly references: readonly ObjectRecord[];
  readonly minutesAfterPrevious: number;
};

/** What is pulling a cable down: an unanswered ask and how long it has hung there. */
export type CableLoad = {
  readonly record: ObjectRecord;
  readonly sourceMessageId: string;
  readonly hoursWaiting: number;
};

/** One conversation, with everything the canvas needs to draw it. */
export type Cable = {
  readonly record: ObjectRecord;
  readonly agent: ObjectRecord | null;
  readonly agentName: string;
  readonly agentRole: string;
  /** Present only when the thread actually discusses a Mission. Never a placeholder. */
  readonly mission: ObjectRecord | null;
  readonly messages: readonly CableMessage[];
  readonly load: CableLoad | null;
  readonly lastActivityAt: string;
};

/** The complete read-only projection consumed by the Catenary view. */
export type CatenaryModel = {
  readonly cables: readonly Cable[];
  readonly agents: readonly { readonly record: ObjectRecord; readonly role: string }[];
  readonly entryCableId: string | null;
  readonly waitingCount: number;
};

function roleOf(graph: ObjectGraph, agent: ObjectRecord | null): string {
  if (!agent) return 'Unseated';
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  if (!seat) return 'Unseated';
  return graph.relatedBy(seat.id, 'requests')[0]?.title ?? 'Unseated';
}

function sortedMessages(graph: ObjectGraph, threadId: string): readonly ObjectRecord[] {
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
  return Math.max(0, Math.round((currentTime - previousTime) / MILLISECONDS_PER_MINUTE));
}

function isUnresolved(record: ObjectRecord): boolean {
  const status = field(record, 'status');
  if (record.kind === 'request') return status === 'pending' || status === '';
  return UNRESOLVED_STATUSES.includes(status);
}

/** The newest turn anywhere in the fixture set. This world's "now", not the wall clock. */
function roomNowMilliseconds(graph: ObjectGraph): number {
  const times = graph
    .byKind('message')
    .map((record) => Date.parse(field(record, 'createdAt')))
    .filter((time) => Number.isFinite(time));
  return times.length > 0 ? Math.max(...times) : 0;
}

function hoursSince(record: ObjectRecord, roomNow: number): number {
  const sent = Date.parse(field(record, 'createdAt'));
  if (!Number.isFinite(sent) || roomNow === 0) return 0;
  return Math.max(0, (roomNow - sent) / MILLISECONDS_PER_HOUR);
}

/** The most recent unresolved object an agent put in front of you. */
function openAsk(messages: readonly CableMessage[]): CableMessage | null {
  for (const message of [...messages].reverse()) {
    if (message.references.some(isUnresolved)) return message;
  }
  return null;
}

/** An agent turn nobody answered is itself a load, even with nothing formally open. */
function unansweredTurn(messages: readonly CableMessage[]): CableMessage | null {
  const latest = messages.at(-1);
  return latest && !latest.mine ? latest : null;
}

function loadFor(messages: readonly CableMessage[], roomNow: number): CableLoad | null {
  const asking = openAsk(messages);
  if (asking) {
    const ask = asking.references.find(isUnresolved);
    if (ask) {
      return {
        record: ask,
        sourceMessageId: asking.record.id,
        hoursWaiting: hoursSince(asking.record, roomNow),
      };
    }
  }

  const waiting = unansweredTurn(messages);
  if (!waiting) return null;
  return {
    record: waiting.record,
    sourceMessageId: waiting.record.id,
    hoursWaiting: hoursSince(waiting.record, roomNow),
  };
}

/** Only a Mission the thread really discusses. A standalone conversation returns null. */
function missionFor(graph: ObjectGraph, thread: ObjectRecord): ObjectRecord | null {
  return graph.relatedOfKind(thread.id, 'discusses', 'mission')[0] ?? null;
}

function projectCable(graph: ObjectGraph, thread: ObjectRecord, roomNow: number): Cable {
  const records = sortedMessages(graph, thread.id);
  const messages = records.map((record, index) => ({
    record,
    mine: field(record, 'senderId') === PRINCIPAL_ID,
    references: graph.relatedBy(record.id, 'references'),
    minutesAfterPrevious: minutesBetween(records[index - 1], record),
  }));
  const agent = graph.relatedOfKind(thread.id, 'discusses', 'agent')[0] ?? null;

  return {
    record: thread,
    agent,
    agentName: agent?.title ?? 'New conversation',
    agentRole: roleOf(graph, agent),
    mission: missionFor(graph, thread),
    messages,
    load: loadFor(messages, roomNow),
    lastActivityAt: field(records.at(-1), 'createdAt') || field(thread, 'ts'),
  };
}

function byMostRecentActivity(left: Cable, right: Cable): number {
  return right.lastActivityAt.localeCompare(left.lastActivityAt);
}

function entryCableId(cables: readonly Cable[], attentionSubjectId: string | null): string | null {
  const elected = cables.find((cable) => (
    cable.record.id === attentionSubjectId || cable.load?.record.id === attentionSubjectId
  ));
  const loaded = [...cables].sort(
    (left, right) => (right.load?.hoursWaiting ?? -1) - (left.load?.hoursWaiting ?? -1),
  )[0];
  return elected?.record.id ?? (loaded?.load ? loaded.record.id : cables[0]?.record.id ?? null);
}

/** Builds the Catenary projection without owning or mutating any graph fact. */
export function buildCatenaryModel(
  graph: ObjectGraph,
  threads: readonly ObjectRecord[],
  liveAgents: readonly ObjectRecord[],
  attentionSubjectId: string | null,
): CatenaryModel {
  const roomNow = roomNowMilliseconds(graph);
  const cables = threads
    .map((thread) => projectCable(graph, thread, roomNow))
    .sort(byMostRecentActivity);

  return {
    cables,
    agents: liveAgents.map((record) => ({ record, role: roleOf(graph, record) })),
    entryCableId: entryCableId(cables, attentionSubjectId),
    waitingCount: cables.filter((cable) => cable.load).length,
  };
}
