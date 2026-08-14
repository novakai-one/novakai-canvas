/**
 * What needs a human right now, derived from object state.
 *
 * No fixture carries an `attentionReason` field. If it did, the feed would be a second
 * copy of the truth that drifts from the first — so every item here is computed from
 * the same records the Rooms render, and resolving the underlying object is what makes
 * an item disappear.
 */
import type { ObjectGraph } from '../object-graph/graph';
import { field } from '../object-graph/graph';
import type { ObjectId, ObjectRecord } from '../object-graph/contract';

export type AttentionReason =
  | 'decision'
  | 'agent-failed'
  | 'blocked'
  | 'seat-vacant'
  | 'issue'
  | 'message-waiting'
  | 'milestone'
  | 'completed';

export type AttentionAction = {
  /** Verb the person sees. Same word appears in the resulting state. */
  readonly label: string;
  readonly kind: 'respond' | 'approve' | 'stop' | 'reassign' | 'clear';
};

export type AttentionItem = {
  readonly id: string;
  readonly reason: AttentionReason;
  readonly subject: ObjectRecord;
  /** What to call the subject on a row. Some stores hold no title of their own. */
  readonly label: string;
  /** What is true, in one line. Never states urgency — position and accent do that. */
  readonly detail: string;
  readonly since: string;
  readonly actions: readonly AttentionAction[];
  /** The object an explicit Open action would move to, if different from the subject. */
  readonly openId: ObjectId;
};

export const REASON_LABEL: Record<AttentionReason, string> = {
  decision: 'Decision waiting',
  'agent-failed': 'Agent stopped',
  blocked: 'Work blocked',
  'seat-vacant': 'Seat unfilled',
  issue: 'Issue open',
  'message-waiting': 'Reply waiting',
  milestone: 'Milestone near',
  completed: 'Completed',
};

/** Which reason outranks which. The single gold signal is elected from the top. */
const RANK: Record<AttentionReason, number> = {
  decision: 0,
  'agent-failed': 1,
  blocked: 2,
  'seat-vacant': 3,
  issue: 4,
  'message-waiting': 5,
  milestone: 6,
  completed: 7,
};

/** Groups the Command Center renders, in the order the brief lists them. */
export const REASON_GROUPS: readonly AttentionReason[] = [
  'decision',
  'blocked',
  'agent-failed',
  'seat-vacant',
  'issue',
  'message-waiting',
  'milestone',
  'completed',
];

function ago(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(1, Math.round((now - then) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Fixture timestamps sit on 14 Aug 2026; "now" is anchored so ages read sensibly. */
const NOW = Date.parse('2026-08-14T09:30:00Z');

export function buildFeed(graph: ObjectGraph): AttentionItem[] {
  const items: AttentionItem[] = [];
  const push = (item: AttentionItem) => {
    if (field(item.subject, 'attentionState') !== 'settled') items.push(item);
  };

  for (const request of graph.byKind('request')) {
    if (field(request, 'status') !== 'pending') continue;
    const blocks = graph.relatedBy(request.id, 'blocks');
    push({
      id: `att_${request.id}`,
      reason: 'decision',
      subject: request,
      label: request.title,
      detail: blocks.length ? `Holding ${blocks[0].title}` : 'No work is moving on this',
      since: ago(field(request, 'updated') || request.createdAt, NOW),
      actions: [{ label: 'Respond', kind: 'respond' }],
      openId: blocks.find((r) => r.kind === 'mission')?.id ?? request.id,
    });
  }

  for (const agent of graph.byKind('agent')) {
    if (field(agent, 'status') !== 'failed') continue;
    const seat = graph.relatedBy(agent.id, 'occupies')[0];
    push({
      id: `att_${agent.id}`,
      reason: 'agent-failed',
      subject: agent,
      label: agent.title,
      detail: seat
        ? `Left the ${graph.relatedBy(seat.id, 'requests')[0]?.title ?? 'team'} seat`
        : 'Stopped mid-task',
      since: ago(field(agent, 'updated') || agent.createdAt, NOW),
      actions: [
        { label: 'Replace agent', kind: 'reassign' },
        { label: 'Stop', kind: 'stop' },
      ],
      openId: agent.id,
    });
  }

  for (const task of graph.byKind('task')) {
    if (field(task, 'status') !== 'blocked') continue;
    push({
      id: `att_${task.id}`,
      reason: 'blocked',
      subject: task,
      label: task.title,
      detail: field(task, 'blockedReason') || 'Blocked with no reason recorded',
      since: ago(field(task, 'updated') || task.createdAt, NOW),
      actions: [{ label: 'Unblock', kind: 'approve' }],
      openId: graph.relatedBy(task.id, 'belongsTo').find((r) => r.kind === 'stage')?.id ?? task.id,
    });
  }

  for (const seat of graph.byKind('teamSeat')) {
    if (seat.fields.agentId) continue;
    const role = graph.relatedBy(seat.id, 'requests')[0];
    const team = graph.relatedBy(seat.id, 'belongsTo')[0];
    push({
      id: `att_${seat.id}`,
      reason: 'seat-vacant',
      subject: seat,
      label: `${role?.title ?? 'Unnamed'} seat`,
      detail: `${role?.title ?? 'Role'} seat on ${team?.title ?? 'a team'} has nobody in it`,
      since: '—',
      actions: [{ label: 'Assign agent', kind: 'reassign' }],
      openId: role?.id ?? seat.id,
    });
  }

  for (const issue of graph.byKind('issue')) {
    if (field(issue, 'status') !== 'open' || field(issue, 'severity') !== 'high') continue;
    push({
      id: `att_${issue.id}`,
      reason: 'issue',
      subject: issue,
      label: issue.title,
      detail: field(issue, 'body'),
      since: ago(field(issue, 'updated') || issue.createdAt, NOW),
      actions: [{ label: 'Resolve', kind: 'approve' }],
      openId: graph.relatedBy(issue.id, 'raisedAgainst').find((r) => r.kind === 'mission')?.id ?? issue.id,
    });
  }

  for (const notification of graph.byKind('notification')) {
    if (field(notification, 'status') !== 'unread') continue;
    const subject = graph.relatedBy(notification.id, 'about')[0];
    if (!subject || subject.kind !== 'thread') continue;
    const agent = graph.relatedBy(subject.id, 'discusses').find((r) => r.kind === 'agent');
    const messages = graph.relatedOfKind(subject.id, 'contains', 'message');
    const last = messages[messages.length - 1];
    push({
      id: `att_${notification.id}`,
      reason: 'message-waiting',
      subject: notification,
      label: agent ? `${agent.title} is waiting on a reply` : 'A conversation is waiting',
      detail: agent ? `${agent.title} — ${last?.title ?? 'new message'}` : 'New message',
      since: ago(last?.createdAt ?? '', NOW),
      actions: [{ label: 'Mark read', kind: 'clear' }],
      openId: subject.id,
    });
  }

  for (const stage of graph.byKind('stage')) {
    if (field(stage, 'status') !== 'active' || stage.fields.parentStageId) continue;
    const mission = graph.relatedBy(stage.id, 'belongsTo').find((r) => r.kind === 'mission');
    if (!mission) continue;
    const siblings = graph
      .relatedOfKind(mission.id, 'contains', 'stage')
      .filter((s) => !s.fields.parentStageId);
    const order = Number(stage.fields.order ?? 0);
    const earlier = siblings.filter((s) => Number(s.fields.order ?? 0) < order);
    if (earlier.length === 0 || !earlier.every((s) => field(s, 'status') === 'done')) continue;
    push({
      id: `att_${stage.id}`,
      reason: 'milestone',
      subject: stage,
      label: stage.title,
      detail: `${field(stage, 'condition')} — everything before it is done`,
      since: '—',
      actions: [{ label: 'Dismiss', kind: 'clear' }],
      openId: mission.id,
    });
  }

  for (const mission of graph.byKind('mission')) {
    if (field(mission, 'status') !== 'completed') continue;
    push({
      id: `att_${mission.id}`,
      reason: 'completed',
      subject: mission,
      label: mission.title,
      detail: field(mission, 'notes'),
      since: ago(field(mission, 'updated') || mission.createdAt, NOW),
      actions: [{ label: 'Dismiss', kind: 'clear' }],
      openId: mission.id,
    });
  }

  return items.sort((a, b) => RANK[a.reason] - RANK[b.reason]);
}

/**
 * Elects the single subject allowed to wear gold.
 *
 * Components ask whether they are the elected one; they cannot decide it for
 * themselves. That is what stops "one accent" from being a matter of discipline.
 */
export function electAttention(items: readonly AttentionItem[]): AttentionItem | null {
  return items.length ? items[0] : null;
}
