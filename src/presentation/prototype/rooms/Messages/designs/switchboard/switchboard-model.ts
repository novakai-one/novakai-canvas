/**
 * Graph in, switchboard out: agents as vertical lines, conversations hanging on them.
 *
 * Every fact the field renders is computed here once: which rails exist, how long ago
 * each conversation last moved, which single conversation holds the elected attention,
 * and whether a real Mission tie exists. Pure projection — nothing here writes.
 */
import type { ObjectGraph } from '../../../../object-graph/graph';
import { field } from '../../../../object-graph/graph';
import type { ObjectId, ObjectRecord } from '../../../../object-graph/contract';

export type SwitchboardThread = {
  readonly thread: ObjectRecord;
  readonly agent: ObjectRecord | null;
  /** Non-null only when a real Mission tie exists; standalone threads carry null. */
  readonly mission: ObjectRecord | null;
  readonly lastMessage: ObjectRecord | null;
  readonly messageCount: number;
  /** Milliseconds since this conversation last moved, against the field's own "now". */
  readonly elapsedMs: number;
  readonly unread: boolean;
  /** The one conversation holding the elected attention subject. */
  readonly amber: boolean;
};

export type SwitchboardRail = {
  readonly agent: ObjectRecord | null;
  readonly name: string;
  readonly role: string;
  readonly live: boolean;
  /** Newest first — the top plaque on the rail is the most recent conversation. */
  readonly threads: readonly SwitchboardThread[];
};

export type SwitchboardModel = {
  readonly rails: readonly SwitchboardRail[];
  readonly amberThreadId: string | null;
  /** The newest activity across the whole field. All drops measure from here. */
  readonly nowEpoch: number;
};

function epochOf(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function roleOf(graph: ObjectGraph, agent: ObjectRecord): string {
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  return (seat && graph.relatedBy(seat.id, 'requests')[0]?.title) || 'Unseated';
}

/** A thread carries the attention when it, or an object cited inside it, is elected. */
function holdsAttention(
  graph: ObjectGraph,
  thread: ObjectRecord,
  messages: readonly ObjectRecord[],
  electedId: ObjectId | null,
): boolean {
  if (!electedId) return false;
  if (thread.id === electedId) return true;
  return messages.some((message) =>
    graph.relatedBy(message.id, 'references').some((cited) => cited.id === electedId),
  );
}

export function buildSwitchboardModel(
  graph: ObjectGraph,
  electedId: ObjectId | null,
  liveAgents: readonly ObjectRecord[],
): SwitchboardModel {
  const unreadThreadIds = new Set(
    graph
      .byKind('notification')
      .filter((notification) => field(notification, 'status') === 'unread')
      .map((notification) => (notification.fields.subjectRef as { id?: string } | undefined)?.id)
      .filter((id): id is string => Boolean(id)),
  );

  let amberThreadId: string | null = null;

  const threads = graph.byKind('thread').map((thread): SwitchboardThread => {
    const discussed = graph.relatedBy(thread.id, 'discusses');
    const messages = graph
      .relatedOfKind(thread.id, 'contains', 'message')
      .slice()
      .sort((a, b) => (field(a, 'createdAt') < field(b, 'createdAt') ? -1 : 1));
    const lastMessage = messages.at(-1) ?? null;
    const amber = !amberThreadId && holdsAttention(graph, thread, messages, electedId);
    if (amber) amberThreadId = thread.id;
    return {
      thread,
      agent: discussed.find((record) => record.kind === 'agent') ?? null,
      mission: discussed.find((record) => record.kind === 'mission') ?? null,
      lastMessage,
      messageCount: messages.length,
      elapsedMs: 0, // measured below, once the field's "now" is known
      unread: unreadThreadIds.has(thread.id),
      amber,
    };
  });

  // The field's clock is its own newest message, not wall time — fixtures stay honest.
  const nowEpoch = Math.max(
    0,
    ...threads.map((entry) =>
      epochOf(field(entry.lastMessage ?? entry.thread, 'createdAt') || field(entry.thread, 'ts')),
    ),
  );

  const measured = threads.map((entry) => {
    const lastEpoch = epochOf(
      field(entry.lastMessage ?? entry.thread, 'createdAt') || field(entry.thread, 'ts'),
    );
    return { ...entry, elapsedMs: Math.max(0, nowEpoch - lastEpoch) };
  });

  // One rail per agent that owns a conversation; live but silent agents still get a line.
  const railsByAgentId = new Map<string, SwitchboardThread[]>();
  const unrouted: SwitchboardThread[] = [];
  for (const entry of measured) {
    if (!entry.agent) {
      unrouted.push(entry);
      continue;
    }
    const bucket = railsByAgentId.get(entry.agent.id) ?? [];
    bucket.push(entry);
    railsByAgentId.set(entry.agent.id, bucket);
  }
  for (const agent of liveAgents) {
    if (!railsByAgentId.has(agent.id)) railsByAgentId.set(agent.id, []);
  }

  const rails: SwitchboardRail[] = [...railsByAgentId.entries()]
    .map(([agentId, railThreads]) => {
      const agent = graph.get(agentId) ?? null;
      return {
        agent,
        name: agent?.title ?? 'Unknown',
        role: agent ? roleOf(graph, agent) : '',
        live: agent ? field(agent, 'status') === 'live' : false,
        threads: railThreads.slice().sort((a, b) => a.elapsedMs - b.elapsedMs),
      };
    })
    // Attention outranks recency: the line that needs you reads first. After that,
    // most recently active lines lead; silent live lines wait at the far end.
    .sort((a, b) => {
      const aAmber = a.threads.some((entry) => entry.amber);
      const bAmber = b.threads.some((entry) => entry.amber);
      if (aAmber !== bAmber) return aAmber ? -1 : 1;
      const aRecent = a.threads[0]?.elapsedMs ?? Number.MAX_SAFE_INTEGER;
      const bRecent = b.threads[0]?.elapsedMs ?? Number.MAX_SAFE_INTEGER;
      return aRecent - bRecent;
    });

  if (unrouted.length > 0) {
    rails.push({
      agent: null,
      name: 'Unrouted',
      role: '',
      live: false,
      threads: unrouted.slice().sort((a, b) => a.elapsedMs - b.elapsedMs),
    });
  }

  return { rails, amberThreadId, nowEpoch };
}
