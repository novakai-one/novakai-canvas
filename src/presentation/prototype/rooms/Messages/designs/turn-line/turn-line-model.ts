/**
 * Graph in, obligations out.
 *
 * Turn Line asks one question of every conversation: whose move is it, and how long has
 * it been theirs? That answer — holder plus wait — is the whole model. A Mission is
 * carried as context a conversation may or may not have; it is never what makes a
 * conversation real, which is why a thread with no Mission projects exactly like the
 * others. Pure projection: nothing here selects, navigates or writes.
 */
import type { ObjectGraph } from '../../../../object-graph/graph';
import { field } from '../../../../object-graph/graph';
import type { ObjectId, ObjectRecord } from '../../../../object-graph/contract';

/** Which side of the seam a conversation rests on. */
export type TurnHolder = 'you' | 'them';

export type TurnLineMessage = {
  readonly record: ObjectRecord;
  readonly mine: boolean;
  readonly speaker: string;
  readonly time: string;
  readonly references: readonly ObjectRecord[];
};

export type TurnLineThread = {
  readonly id: string;
  readonly thread: ObjectRecord;
  readonly agent: ObjectRecord | undefined;
  readonly mission: ObjectRecord | undefined;
  readonly name: string;
  readonly monogram: string;
  readonly messages: readonly TurnLineMessage[];
  /** Who owes the next turn. The last speaker hands it to the other side. */
  readonly holder: TurnHolder;
  /** How long the holder has been sitting on it, measured against the field horizon. */
  readonly waitMs: number;
  /** Message count — how deep this exchange has gone. */
  readonly exchange: number;
  /** The agent has a working presence right now. */
  readonly live: boolean;
  /** Nothing has been said yet: a footprint, not a block. */
  readonly ghost: boolean;
  readonly unread: boolean;
  readonly lastLine: string;
  /** Set when the one elected attention subject is cited inside this conversation. */
  readonly amberCitationId: string | null;
};

export type TurnLineModel = {
  readonly threads: readonly TurnLineThread[];
  /** The most recent activity anywhere — the field's "now". */
  readonly horizon: number;
  readonly maxWaitMs: number;
  readonly amberThreadId: string | null;
  readonly holdingCount: number;
};

const PRINCIPAL_ID = 'principal_chris';

function epochOf(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function clockOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

function monogramOf(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Reads one conversation, in message order, with the objects each turn cites. */
function readMessages(
  graph: ObjectGraph,
  thread: ObjectRecord,
  agentName: string,
): TurnLineMessage[] {
  return graph
    .relatedOfKind(thread.id, 'contains', 'message')
    .slice()
    .sort((a, b) => (field(a, 'createdAt') < field(b, 'createdAt') ? -1 : 1))
    .map((record) => {
      const mine = field(record, 'senderId') === PRINCIPAL_ID;
      return {
        record,
        mine,
        speaker: mine ? 'You' : agentName,
        time: clockOf(field(record, 'createdAt')),
        references: graph.relatedBy(record.id, 'references'),
      };
    });
}

export function buildTurnLineModel(
  graph: ObjectGraph,
  liveAgents: readonly ObjectRecord[],
  electedId: ObjectId | null,
): TurnLineModel {
  const liveAgentIds = new Set(liveAgents.map((agent) => agent.id));
  const unreadThreadIds = new Set(
    graph
      .byKind('notification')
      .filter((notification) => field(notification, 'status') === 'unread')
      .map((notification) => (notification.fields.subjectRef as { id?: string } | undefined)?.id)
      .filter((id): id is string => Boolean(id)),
  );

  const read = graph.byKind('thread').map((thread) => {
    const discussed = graph.relatedBy(thread.id, 'discusses');
    const agent = discussed.find((record) => record.kind === 'agent');
    const mission = discussed.find((record) => record.kind === 'mission');
    const name = agent?.title ?? thread.title;
    const messages = readMessages(graph, thread, name);
    const last = messages[messages.length - 1];

    let amberCitationId: string | null = null;
    if (electedId) {
      const cited = messages
        .flatMap((message) => message.references)
        .find((record) => record.id === electedId);
      if (cited) amberCitationId = cited.id;
      else if (thread.id === electedId) amberCitationId = thread.id;
    }

    return {
      id: thread.id,
      thread,
      agent,
      mission,
      name,
      monogram: monogramOf(name),
      messages,
      // The last speaker hands the turn over: their word means the move is now yours.
      holder: (last && !last.mine ? 'you' : 'them') as TurnHolder,
      activity: last
        ? epochOf(field(last.record, 'createdAt'))
        : epochOf(field(thread, 'ts') || thread.createdAt),
      exchange: messages.length,
      live: agent ? liveAgentIds.has(agent.id) : false,
      ghost: messages.length === 0,
      unread: unreadThreadIds.has(thread.id),
      lastLine: last ? field(last.record, 'body') : 'Nothing said yet.',
      amberCitationId,
    };
  });

  const horizon = read.reduce((newest, entry) => Math.max(newest, entry.activity), 0);

  const threads: TurnLineThread[] = read
    .map(({ activity, ...rest }) => ({ ...rest, waitMs: Math.max(0, horizon - activity) }))
    .sort((a, b) => a.waitMs - b.waitMs);

  return {
    threads,
    horizon,
    maxWaitMs: threads.reduce((longest, entry) => Math.max(longest, entry.waitMs), 0),
    amberThreadId: threads.find((entry) => entry.amberCitationId)?.id ?? null,
    holdingCount: threads.filter((entry) => entry.holder === 'you').length,
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long a side has held the turn, written the way a person would say it. */
export function formatWait(waitMs: number): string {
  if (waitMs < 90 * MINUTE) return `${Math.max(1, Math.round(waitMs / MINUTE))}m`;
  if (waitMs < DAY) return `${Math.round(waitMs / HOUR)}h`;
  return `${Math.round(waitMs / DAY)}d`;
}

/** Conversations other than this one that cite the same object. */
export function alsoDiscussedIn(
  graph: ObjectGraph,
  recordId: ObjectId,
  exceptThreadId: string,
): readonly ObjectRecord[] {
  const threads = graph
    .relatedBy(recordId, 'referencedBy')
    .filter((record) => record.kind === 'message')
    .map((message) => graph.relatedBy(message.id, 'belongsTo').find((r) => r.kind === 'thread'))
    .filter((thread): thread is ObjectRecord => thread !== undefined && thread.id !== exceptThreadId);
  return [...new Map(threads.map((thread) => [thread.id, thread])).values()];
}
