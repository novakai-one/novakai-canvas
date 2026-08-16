/**
 * Vigil's read-only projection of the object graph.
 *
 * A conversation is the first-class object here. It is projected from its own messages
 * and its Agent; a Mission is optional context that appears only when the thread really
 * discusses one. Nothing in this module invents a parent for a standalone conversation.
 */
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';

/** One message in a conversation, with the silence that preceded it. */
type VigilMoment = {
  readonly record: ObjectRecord;
  readonly mine: boolean;
  readonly references: readonly ObjectRecord[];
  readonly minutesBeforePrevious: number;
};

/** One conversation, seated on the floor by how long it has been silent. */
export type VigilLantern = {
  readonly record: ObjectRecord;
  readonly agent: ObjectRecord | null;
  readonly agentName: string;
  readonly agentRole: string;
  /** Present only when the thread genuinely discusses a Mission. Never fabricated. */
  readonly mission: ObjectRecord | null;
  readonly moments: readonly VigilMoment[];
  readonly silentMinutes: number;
  readonly awaitingReply: boolean;
  /** The unresolved object this conversation is stuck on, when there is one. */
  readonly pending: ObjectRecord | null;
  /** True for the single elected subject. At most one lantern on the floor holds this. */
  readonly attention: boolean;
};

/** A live Agent offered on the shelf as somebody you can start talking to. */
export type VigilAgent = {
  readonly record: ObjectRecord;
  readonly role: string;
};

/** Everything the Vigil view renders, derived and owned by nobody else. */
export type VigilModel = {
  readonly lanterns: readonly VigilLantern[];
  readonly agents: readonly VigilAgent[];
  readonly waitingCount: number;
  readonly entryLanternId: string | null;
  readonly attentionLanternId: string | null;
};

/** Statuses that mean a referenced object is still open business. */
const UNRESOLVED_STATUSES = ['open', 'blocked', 'failed', 'paused'];

const CHRIS = 'principal_chris';

function isUnresolved(record: ObjectRecord): boolean {
  const status = field(record, 'status');
  if (record.kind === 'request') return status === 'pending' || status === '';
  return UNRESOLVED_STATUSES.includes(status);
}

function roleOf(graph: ObjectGraph, agent: ObjectRecord | null): string {
  if (!agent) return 'Agent';
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  if (!seat) return 'Agent';
  return graph.relatedBy(seat.id, 'requests')[0]?.title ?? 'Agent';
}

function messagesNewestFirst(graph: ObjectGraph, threadId: string): readonly ObjectRecord[] {
  return graph
    .relatedOfKind(threadId, 'contains', 'message')
    .slice()
    .sort((left, right) => field(right, 'createdAt').localeCompare(field(left, 'createdAt')));
}

function minutesBetween(later: ObjectRecord | undefined, earlier: ObjectRecord): number {
  if (!later) return 0;
  const laterTime = Date.parse(field(later, 'createdAt'));
  const earlierTime = Date.parse(field(earlier, 'createdAt'));
  if (!Number.isFinite(laterTime) || !Number.isFinite(earlierTime)) return 0;
  return Math.max(0, Math.round((laterTime - earlierTime) / 60_000));
}

/**
 * The floor's present moment.
 *
 * Fixture conversations were written at fixed past timestamps, so measuring silence
 * against the wall clock would push every lantern into the outermost ring and flatten
 * the axis. The newest message anywhere is the room's now; anything sent live becomes
 * the new now by the same rule.
 */
function roomNow(graph: ObjectGraph): number {
  const times = graph
    .byKind('message')
    .map((record) => Date.parse(field(record, 'createdAt')))
    .filter((time) => Number.isFinite(time));
  return times.length > 0 ? Math.max(...times) : Date.now();
}

function silentMinutesSince(newest: ObjectRecord | undefined, now: number): number {
  if (!newest) return Number.POSITIVE_INFINITY;
  const time = Date.parse(field(newest, 'createdAt'));
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - time) / 60_000);
}

function projectMoments(graph: ObjectGraph, threadId: string): readonly VigilMoment[] {
  const records = messagesNewestFirst(graph, threadId);
  return records.map((record, index) => ({
    record,
    mine: field(record, 'senderId') === CHRIS,
    references: graph.relatedBy(record.id, 'references'),
    minutesBeforePrevious: minutesBetween(records[index - 1], record),
  }));
}

/** The newest unresolved object the conversation referred to, if it is still open. */
function pendingReference(moments: readonly VigilMoment[]): ObjectRecord | null {
  for (const moment of moments) {
    const unresolved = moment.references.find(isUnresolved);
    if (unresolved) return unresolved;
  }
  return null;
}

/** True when the elected subject is this thread, one of its messages, or a thing it cites. */
function holdsAttention(
  thread: ObjectRecord,
  moments: readonly VigilMoment[],
  attentionSubjectId: string | null,
): boolean {
  if (!attentionSubjectId) return false;
  if (thread.id === attentionSubjectId) return true;
  return moments.some((moment) => (
    moment.record.id === attentionSubjectId
    || moment.references.some((record) => record.id === attentionSubjectId)
  ));
}

function projectLantern(
  graph: ObjectGraph,
  thread: ObjectRecord,
  now: number,
  attentionSubjectId: string | null,
): VigilLantern {
  const moments = projectMoments(graph, thread.id);
  const discussed = graph.relatedBy(thread.id, 'discusses');
  const agent = discussed.find((record) => record.kind === 'agent') ?? null;
  const newest = moments[0];

  return {
    record: thread,
    agent,
    agentName: agent?.title ?? 'Conversation',
    agentRole: roleOf(graph, agent),
    mission: discussed.find((record) => record.kind === 'mission') ?? null,
    moments,
    silentMinutes: silentMinutesSince(newest?.record, now),
    awaitingReply: newest ? !newest.mine : false,
    pending: pendingReference(moments),
    attention: holdsAttention(thread, moments, attentionSubjectId),
  };
}

/** Quietest-first is wrong for entry: open on whatever is closest to needing you. */
function entryLanternId(lanterns: readonly VigilLantern[]): string | null {
  const elected = lanterns.find((lantern) => lantern.attention);
  const waiting = lanterns.find((lantern) => lantern.pending !== null);
  return (elected ?? waiting ?? lanterns[0])?.record.id ?? null;
}

/** Builds Vigil's model. It reads the graph and owns none of it. */
export function buildVigilModel(
  graph: ObjectGraph,
  threads: readonly ObjectRecord[],
  liveAgents: readonly ObjectRecord[],
  attentionSubjectId: string | null,
): VigilModel {
  const now = roomNow(graph);
  const lanterns = threads
    .map((thread) => projectLantern(graph, thread, now, attentionSubjectId))
    .sort((left, right) => left.silentMinutes - right.silentMinutes);

  return {
    lanterns,
    agents: liveAgents.map((record) => ({ record, role: roleOf(graph, record) })),
    waitingCount: lanterns.filter((lantern) => lantern.pending !== null).length,
    entryLanternId: entryLanternId(lanterns),
    attentionLanternId: lanterns.find((lantern) => lantern.attention)?.record.id ?? null,
  };
}
