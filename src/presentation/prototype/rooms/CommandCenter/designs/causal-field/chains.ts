/**
 * Attention as cause: each feed item becomes a chain of consequences.
 *
 * Nothing here is invented — every link walks a relation the feed itself already
 * trusts (`blocks`, `belongsTo`, `occupies`, `raisedAgainst`, `about`). The chain is
 * why an item deserves attention, made into geometry the layout can draw.
 */
import type { AttentionItem } from '../../../../attention/feed';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { ObjectId, ObjectRecord } from '../../../../object-graph/contract';

/** One downstream consequence and the verb on the wire that reaches it. */
export type ChainLink = {
  readonly record: ObjectRecord;
  /** Lowercase verb rendered on the wire. Vocabulary, not a relation join. */
  readonly verb: string;
  /** The upstream object this consequence hangs from. */
  readonly from: ObjectId;
  readonly depth: number;
};

export type CausalChain = {
  readonly item: AttentionItem;
  readonly root: ObjectRecord;
  readonly links: readonly ChainLink[];
  /** Everything acting on the root releases — root plus all consequences. */
  readonly weight: number;
  /** Settled chains lie in the sediment; they grow no consequences. */
  readonly settled: boolean;
};

/** Builds one chain per feed item, in feed order (the feed is already rank-sorted). */
export function buildChains(feed: readonly AttentionItem[], graph: ObjectGraph): CausalChain[] {
  return feed.map((item) => {
    const links: ChainLink[] = [];
    const seen = new Set<ObjectId>([item.subject.id]);

    const push = (record: ObjectRecord | undefined, verb: string, from: ObjectId, depth: number) => {
      if (!record || seen.has(record.id)) return false;
      seen.add(record.id);
      links.push({ record, verb, from, depth });
      return true;
    };

    const subject = item.subject;
    switch (item.reason) {
      case 'decision': {
        for (const held of graph.relatedBy(subject.id, 'blocks')) {
          push(held, 'blocks', subject.id, 1);
          if (held.kind === 'task') {
            const stage = graph.relatedBy(held.id, 'belongsTo').find((r) => r.kind === 'stage');
            if (push(stage, 'holds', held.id, 2) && stage) {
              const mission = graph.relatedBy(stage.id, 'belongsTo').find((r) => r.kind === 'mission');
              push(mission, 'holds', stage.id, 3);
            }
          }
        }
        break;
      }
      case 'agent-failed': {
        const seat = graph.relatedBy(subject.id, 'occupies')[0];
        if (push(seat, 'empties', subject.id, 1) && seat) {
          push(graph.relatedBy(seat.id, 'belongsTo')[0], 'weakens', seat.id, 2);
        }
        break;
      }
      case 'blocked': {
        const stage = graph.relatedBy(subject.id, 'belongsTo').find((r) => r.kind === 'stage');
        if (push(stage, 'stalls', subject.id, 1) && stage) {
          const mission = graph.relatedBy(stage.id, 'belongsTo').find((r) => r.kind === 'mission');
          push(mission, 'holds', stage.id, 2);
        }
        break;
      }
      case 'seat-vacant': {
        push(graph.relatedBy(subject.id, 'requests')[0], 'requests', subject.id, 1);
        push(graph.relatedBy(subject.id, 'belongsTo')[0], 'weakens', subject.id, 1);
        break;
      }
      case 'issue': {
        for (const target of graph.relatedBy(subject.id, 'raisedAgainst')) {
          push(target, 'raised against', subject.id, 1);
        }
        break;
      }
      case 'message-waiting': {
        const thread = graph.relatedBy(subject.id, 'about').find((r) => r.kind === 'thread');
        if (push(thread, 'awaits', subject.id, 1) && thread) {
          push(
            graph.relatedBy(thread.id, 'discusses').find((r) => r.kind === 'agent'),
            'idles',
            thread.id,
            2,
          );
        }
        break;
      }
      case 'milestone': {
        push(
          graph.relatedBy(subject.id, 'belongsTo').find((r) => r.kind === 'mission'),
          'nears',
          subject.id,
          1,
        );
        break;
      }
      case 'completed':
        break;
    }

    return {
      item,
      root: subject,
      links,
      weight: links.length + 1,
      settled: item.reason === 'completed',
    };
  });
}

/** Every object a chain touches, root first. The drawer's related rows come from here. */
export function chainMembers(chain: CausalChain): ObjectRecord[] {
  return [chain.root, ...chain.links.map((link) => link.record)];
}
