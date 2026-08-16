import { makeRecord, sessionId } from '../../app/store';
import type { AttentionAction, AttentionItem } from '../../attention/feed';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';
import {
  REPLACEMENT_AGENTS,
  type CommandActionInput,
  type CommandOutcome,
} from './command-center-design';

type AttentionCommandEffects = {
  graph: ObjectGraph;
  patch(id: ObjectId, fields: Record<string, unknown>): void;
  addRecord(record: ObjectRecord): void;
};

function defaultReplacement(): string {
  return REPLACEMENT_AGENTS[Math.floor(Math.random() * REPLACEMENT_AGENTS.length)];
}

function assignAgent(
  item: AttentionItem,
  name: string,
  effects: AttentionCommandEffects,
): CommandOutcome {
  const id = sessionId('agent', name);
  effects.addRecord(makeRecord(id, 'agent', name, {
    status: 'live',
    provider: 'anthropic',
    sessionId: `sess_${name.toLowerCase()}_new`,
    updated: new Date().toISOString(),
  }));

  if (item.reason === 'agent-failed') {
    effects.patch(item.subject.id, { status: 'retired' });
    const seat = effects.graph.relatedBy(item.subject.id, 'occupies')[0];
    if (seat) effects.patch(seat.id, { agentId: id });
    return { state: 'applied', message: `${name} has taken the seat.` };
  }

  effects.patch(item.subject.id, { agentId: id });
  return { state: 'applied', message: `${name} is now occupying this seat.` };
}

/** Applies one Command Center action through the host's authoritative store seam. */
export function applyAttentionCommand(
  item: AttentionItem,
  action: AttentionAction['kind'],
  input: CommandActionInput = {},
  effects: AttentionCommandEffects,
): CommandOutcome {
  if (action === 'respond') {
    if (!input.response) return { state: 'needs-input', message: 'Choose a response first.' };
    effects.patch(item.subject.id, { status: 'answered', answer: input.response });
    return { state: 'applied', message: `Response recorded: ${input.response}` };
  }

  if (action === 'reassign') {
    return assignAgent(item, input.replacement ?? defaultReplacement(), effects);
  }

  if (action === 'stop') {
    effects.patch(item.subject.id, { status: 'retired' });
    return { state: 'applied', message: `${item.subject.title} is stopped and retired.` };
  }

  if (action === 'approve') {
    if (item.reason === 'blocked') {
      effects.patch(item.subject.id, { status: 'todo', blockedReason: '' });
      return { state: 'applied', message: 'Block cleared. Work can move again.' };
    }
    effects.patch(item.subject.id, { status: 'resolved' });
    return { state: 'applied', message: 'Issue marked resolved.' };
  }

  if (item.reason === 'message-waiting') {
    effects.patch(item.subject.id, { status: 'read' });
    return { state: 'applied', message: 'Conversation marked read.' };
  }

  effects.patch(item.subject.id, { attentionState: 'settled' });
  return { state: 'applied', message: 'Attention cleared.' };
}
