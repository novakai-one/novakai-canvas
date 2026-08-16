/**
 * Graph in, ledger out: one continuous record of all agent correspondence.
 *
 * A band is one conversation; a turn is one message with the objects it cites; the
 * amber chain is the single elected attention subject located inside that structure.
 * Pure projection — nothing here writes, navigates or selects.
 */
import type { ObjectGraph } from '../../../../object-graph/graph';
import { field } from '../../../../object-graph/graph';
import type { ObjectId, ObjectRecord } from '../../../../object-graph/contract';
import { bandGapPx, estimateBandHeight, exchangeGapPx, timeRuleLabel } from './ledger-geometry';

export type LedgerTurn = {
  readonly message: ObjectRecord;
  readonly mine: boolean;
  readonly speaker: string;
  readonly time: string;
  /** Vertical air above this turn — elapsed time made spatial. */
  readonly gapPx: number;
  /** Non-null when the silence above deserves its own rule. */
  readonly timeRule: string | null;
  readonly citations: readonly ObjectRecord[];
};

export type LedgerBand = {
  readonly id: string;
  readonly thread: ObjectRecord;
  readonly agent: ObjectRecord | undefined;
  readonly mission: ObjectRecord | undefined;
  readonly turns: readonly LedgerTurn[];
  readonly unread: boolean;
  /** True until the first message lands: a dashed folio, not yet real ink. */
  readonly ghost: boolean;
  readonly lastActivity: number;
  /** Gap above this band in the stack. */
  readonly gapBefore: number;
  readonly estimatedHeight: number;
  /** The elected subject's citation inside this band, if it lives here. */
  readonly amber: { readonly messageId: string; readonly citationId: string } | null;
};

export type LedgerModel = {
  readonly bands: readonly LedgerBand[];
  readonly amberBandId: string | null;
  /** Where the camera lands on entry: amber, else first unread, else newest. */
  readonly entryBandId: string | null;
};

function timeOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

function epochOf(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildLedgerModel(graph: ObjectGraph, electedId: ObjectId | null): LedgerModel {
  const threads = graph.byKind('thread');
  const notifications = graph.byKind('notification');

  const unreadThreadIds = new Set(
    notifications
      .filter((n) => field(n, 'status') === 'unread')
      .map((n) => (n.fields.subjectRef as { id?: string } | undefined)?.id)
      .filter((id): id is string => Boolean(id)),
  );

  const bands = threads
    .map((thread) => {
      const agent = graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'agent');
      const mission = graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'mission');
      const messages = graph
        .relatedOfKind(thread.id, 'contains', 'message')
        .slice()
        .sort((a, b) => (field(a, 'createdAt') < field(b, 'createdAt') ? -1 : 1));

      let amber: LedgerBand['amber'] = null;
      let previous = 0;
      const turns: LedgerTurn[] = messages.map((message, index) => {
        const createdAt = epochOf(field(message, 'createdAt'));
        const elapsed = index === 0 ? 0 : createdAt - previous;
        previous = createdAt;
        const mine = field(message, 'senderId') === 'principal_chris';
        const citations = graph.relatedBy(message.id, 'references');
        if (!amber && electedId) {
          const hit = citations.find((record) => record.id === electedId);
          if (hit) amber = { messageId: message.id, citationId: hit.id };
        }
        return {
          message,
          mine,
          speaker: mine ? 'You' : (agent?.title ?? 'Agent'),
          time: timeOf(field(message, 'createdAt')),
          gapPx: index === 0 ? 0 : exchangeGapPx(elapsed),
          timeRule: index === 0 ? null : timeRuleLabel(elapsed),
          citations,
        };
      });

      const lastActivity =
        turns.length > 0
          ? epochOf(field(turns[turns.length - 1].message, 'createdAt'))
          : epochOf(field(thread, 'ts') || thread.createdAt);

      return {
        id: thread.id,
        thread,
        agent,
        mission,
        turns,
        unread: unreadThreadIds.has(thread.id),
        ghost: turns.length === 0,
        lastActivity,
        gapBefore: 0,
        estimatedHeight: estimateBandHeight(turns.length, turns.length === 0),
        amber,
      };
    })
    .sort((a, b) => a.lastActivity - b.lastActivity)
    .map((band, index, all) => ({
      ...band,
      gapBefore: index === 0 ? 0 : bandGapPx(band.lastActivity - all[index - 1].lastActivity),
    }));

  const amberBandId = bands.find((band) => band.amber)?.id ?? null;
  const entryBandId =
    amberBandId ??
    bands.find((band) => band.unread)?.id ??
    (bands.length > 0 ? bands[bands.length - 1].id : null);

  return { bands, amberBandId, entryBandId };
}
