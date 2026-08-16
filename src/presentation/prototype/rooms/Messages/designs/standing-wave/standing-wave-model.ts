/**
 * Standing Wave's reading of the object graph.
 *
 * A conversation is the first-class object here. Every trace is built from the thread
 * itself and stands on its own; a Mission is attached only when the graph actually
 * relates one, and when it does not, nothing takes its place. There is deliberately no
 * "no Mission" fallback string in this module — a standalone Agent conversation carries
 * `mission: null` and the views simply render one fewer line.
 *
 * The module also elects the single conversation allowed to hold the amber accent. One
 * peak per Room is a design rule, so it is decided once here rather than in each view.
 */
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';

const PRINCIPAL_ID = 'principal_chris';
const UNRESOLVED_STATUSES = ['open', 'blocked', 'failed', 'paused'];

/** One message, already sorted and resolved against its references. */
type WaveMessage = {
  readonly record: ObjectRecord;
  readonly mine: boolean;
  readonly time: string;
  readonly body: string;
  readonly references: readonly ObjectRecord[];
};

/** The object a conversation is waiting on Chris for, and the message that raised it. */
type WaveOwing = {
  readonly record: ObjectRecord;
  readonly sourceMessageId: string;
};

/** One conversation, readable on its own identity. */
export type WaveTrace = {
  readonly record: ObjectRecord;
  readonly agent: ObjectRecord | null;
  readonly agentRole: string;
  /** Present only when the graph actually relates a Mission to this conversation. */
  readonly mission: ObjectRecord | null;
  readonly messages: readonly WaveMessage[];
  readonly lastActivity: string;
  readonly awaitingReply: boolean;
  readonly owing: WaveOwing | null;
};

/** A live agent, ready to be messaged from the now rail. */
export type WaveAgent = {
  readonly record: ObjectRecord;
  readonly role: string;
  readonly threadId: string | null;
};

/** Everything the Standing Wave views read, with the single amber peak already elected. */
export type StandingWaveModel = {
  readonly traces: readonly WaveTrace[];
  readonly agents: readonly WaveAgent[];
  readonly peakThreadId: string | null;
  readonly entryThreadId: string | null;
};

/** Two-letter mark for an agent, used by the lane legend and the now rail. */
export function initialsFor(title: string): string {
  const words = title.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '?';
  const second = words[1]?.[0] ?? words[0]?.[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

function roleOf(graph: ObjectGraph, agent: ObjectRecord | null): string {
  if (!agent) return 'Unseated';
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  if (!seat) return 'Unseated';
  return graph.relatedBy(seat.id, 'requests')[0]?.title ?? 'Unseated';
}

function isUnresolved(record: ObjectRecord): boolean {
  const status = field(record, 'status');
  if (record.kind === 'request') return status === 'pending' || status === '';
  return UNRESOLVED_STATUSES.includes(status);
}

function readMessages(graph: ObjectGraph, threadId: string): WaveMessage[] {
  return graph
    .relatedOfKind(threadId, 'contains', 'message')
    .slice()
    .sort((left, right) => field(left, 'createdAt').localeCompare(field(right, 'createdAt')))
    .map((record) => ({
      record,
      mine: field(record, 'senderId') === PRINCIPAL_ID,
      time: field(record, 'createdAt'),
      body: field(record, 'body') || record.title,
      references: graph.relatedBy(record.id, 'references'),
    }));
}

/** The newest unresolved thing this conversation has put in front of Chris. */
function owingFor(messages: readonly WaveMessage[]): WaveOwing | null {
  for (const message of [...messages].reverse()) {
    const unresolved = message.references.find(isUnresolved);
    if (unresolved) return { record: unresolved, sourceMessageId: message.record.id };
  }
  return null;
}

function buildTrace(graph: ObjectGraph, thread: ObjectRecord): WaveTrace {
  const messages = readMessages(graph, thread.id);
  const discussed = graph.relatedBy(thread.id, 'discusses');
  const agent = discussed.find((record) => record.kind === 'agent') ?? null;
  const latest = messages.at(-1);

  return {
    record: thread,
    agent,
    agentRole: roleOf(graph, agent),
    mission: discussed.find((record) => record.kind === 'mission') ?? null,
    messages,
    lastActivity: latest?.time ?? field(thread, 'ts'),
    awaitingReply: latest ? !latest.mine : false,
    owing: owingFor(messages),
  };
}

/** Elects the one conversation allowed to hold amber: attention first, then oldest debt. */
function electPeak(
  traces: readonly WaveTrace[],
  attentionSubjectId: string | null,
): string | null {
  const attentive = traces.find((trace) => (
    trace.record.id === attentionSubjectId || trace.owing?.record.id === attentionSubjectId
  ));
  if (attentive) return attentive.record.id;

  const owing = traces
    .filter((trace) => trace.owing !== null)
    .sort((left, right) => left.lastActivity.localeCompare(right.lastActivity));
  return owing[0]?.record.id ?? null;
}

function threadIdForAgent(traces: readonly WaveTrace[], agentId: string): string | null {
  return traces.find((trace) => trace.agent?.id === agentId)?.record.id ?? null;
}

/** Builds the Standing Wave reading without owning or mutating any graph fact. */
export function buildStandingWaveModel(
  graph: ObjectGraph,
  threads: readonly ObjectRecord[],
  liveAgents: readonly ObjectRecord[],
  attentionSubjectId: string | null,
): StandingWaveModel {
  const traces = threads
    .map((thread) => buildTrace(graph, thread))
    .sort((left, right) => right.lastActivity.localeCompare(left.lastActivity));
  const peakThreadId = electPeak(traces, attentionSubjectId);

  return {
    traces,
    agents: liveAgents.map((record) => ({
      record,
      role: roleOf(graph, record),
      threadId: threadIdForAgent(traces, record.id),
    })),
    peakThreadId,
    entryThreadId: peakThreadId ?? traces[0]?.record.id ?? null,
  };
}
