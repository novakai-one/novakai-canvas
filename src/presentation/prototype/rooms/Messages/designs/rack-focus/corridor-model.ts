/**
 * Graph in, corridor out: every conversation becomes one glass pane ranked by recency.
 *
 * Rank 0 is the freshest conversation and hangs nearest the camera; deeper ranks recede
 * into haze. A pane is amber only while it holds the elected attention subject. Pure
 * projection — nothing here writes, navigates or selects.
 */
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { MessagesDesignData } from '../../messages-design';

export type CorridorTurn = {
  readonly message: ObjectRecord;
  readonly mine: boolean;
  readonly speaker: string;
  readonly time: string;
  readonly citations: readonly ObjectRecord[];
};

export type CorridorPane = {
  readonly id: string;
  readonly thread: ObjectRecord;
  readonly agent: ObjectRecord | undefined;
  readonly agentName: string;
  readonly initials: string;
  readonly live: boolean;
  /** What the agent is doing right now, taken from its latest turn. */
  readonly doing: string | null;
  /** Undefined for a standalone conversation — clear glass, no seal. */
  readonly mission: ObjectRecord | undefined;
  readonly turns: readonly CorridorTurn[];
  readonly unread: boolean;
  /** Recency order etched on the floor: '01' is the freshest berth. */
  readonly berth: string;
  /** 0 = nearest the camera. Drives all corridor placement. */
  readonly rank: number;
  readonly lastTime: string;
  /** True while this pane holds the elected attention subject. */
  readonly amber: boolean;
};

export type CorridorModel = {
  readonly panes: readonly CorridorPane[];
  readonly amberPaneId: string | null;
  /** Where focus lands on entry: requested thread, else amber, else freshest. */
  readonly entryPaneId: string | null;
};

function timeOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

function epochOf(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function initialsOf(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/** One line of present-tense activity, short enough to sit under the agent's name. */
function doingCaption(turns: readonly CorridorTurn[]): string | null {
  const lastTurn = [...turns].reverse().find((turn) => !turn.mine) ?? turns[turns.length - 1];
  if (!lastTurn) return null;
  const body = field(lastTurn.message, 'body');
  return body.length > 46 ? `${body.slice(0, 46).trimEnd()}…` : body;
}

export function buildCorridorModel(data: MessagesDesignData): CorridorModel {
  const { graph, threads, attentionSubjectId } = data;

  const unreadThreadIds = new Set(
    graph
      .byKind('notification')
      .filter((n) => field(n, 'status') === 'unread')
      .map((n) => (n.fields.subjectRef as { id?: string } | undefined)?.id)
      .filter((id): id is string => Boolean(id)),
  );

  const unranked = threads.map((thread) => {
    const agent = graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'agent');
    const mission = graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'mission');
    const agentName = agent?.title ?? 'Conversation';

    const turns: CorridorTurn[] = graph
      .relatedOfKind(thread.id, 'contains', 'message')
      .slice()
      .sort((a, b) => (field(a, 'createdAt') < field(b, 'createdAt') ? -1 : 1))
      .map((message) => {
        const mine = field(message, 'senderId') === 'principal_chris';
        return {
          message,
          mine,
          speaker: mine ? 'You' : agentName,
          time: timeOf(field(message, 'createdAt')),
          citations: graph.relatedBy(message.id, 'references'),
        };
      });

    const amber = Boolean(
      attentionSubjectId &&
        turns.some((turn) => turn.citations.some((cited) => cited.id === attentionSubjectId)),
    );

    const lastActivity =
      turns.length > 0
        ? epochOf(field(turns[turns.length - 1].message, 'createdAt'))
        : epochOf(field(thread, 'ts') || thread.createdAt);

    return {
      thread,
      agent,
      agentName,
      mission,
      turns,
      amber,
      lastActivity,
      unread: unreadThreadIds.has(thread.id),
    };
  });

  const panes: CorridorPane[] = unranked
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .map((pane, rank) => ({
      id: pane.thread.id,
      thread: pane.thread,
      agent: pane.agent,
      agentName: pane.agentName,
      initials: initialsOf(pane.agentName),
      live: field(pane.agent, 'status') === 'live',
      doing: doingCaption(pane.turns),
      mission: pane.mission,
      turns: pane.turns,
      unread: pane.unread,
      berth: String(rank + 1).padStart(2, '0'),
      rank,
      lastTime: timeOf(new Date(pane.lastActivity).toISOString()),
      amber: pane.amber,
    }));

  const amberPaneId = panes.find((pane) => pane.amber)?.id ?? null;
  const entryPaneId =
    (data.initialThreadId && panes.find((pane) => pane.id === data.initialThreadId)?.id) ||
    amberPaneId ||
    (panes.length > 0 ? panes[0].id : null);

  return { panes, amberPaneId, entryPaneId };
}
