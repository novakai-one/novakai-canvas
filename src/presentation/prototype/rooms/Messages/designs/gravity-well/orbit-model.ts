/**
 * What the Well knows about each conversation.
 *
 * One reading of the graph, one shape out. Every spatial lever downstream — radius,
 * fill, size, fidelity, grouping — reads a field defined here, so the geometry module
 * never has to ask the graph a question and the view never has to compute meaning.
 */
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignData } from '../../messages-design';

/** The radial axis: how long ago the last turn in a conversation was taken. */
export type TurnBand = 'now' | 'hours' | 'today' | 'quiet';

export const TURN_BANDS: readonly TurnBand[] = ['now', 'hours', 'today', 'quiet'];

const PRINCIPAL_ID = 'principal_chris';
const ONE_HOUR_MS = 60 * 60 * 1000;

const BAND_CEILING_MS: Record<TurnBand, number> = {
  now: ONE_HOUR_MS,
  hours: 12 * ONE_HOUR_MS,
  today: 48 * ONE_HOUR_MS,
  quiet: Number.POSITIVE_INFINITY,
};

/** The sector a conversation sits in. Direct threads own a sector like any Mission. */
export type OrbitGroup = {
  readonly id: string;
  readonly label: string;
  readonly standalone: boolean;
  readonly count: number;
};

export type OrbitBody = {
  readonly thread: ObjectRecord;
  readonly agent: ObjectRecord | null;
  readonly mission: ObjectRecord | null;
  readonly groupId: string;
  readonly band: TurnBand;
  /** The agent spoke last: the turn is yours. Drawn as a filled body. */
  readonly awaitingYou: boolean;
  readonly live: boolean;
  readonly messageCount: number;
  readonly lastLine: string;
  readonly lastSpokenAt: string;
  /** Started but not yet spoken in. Drawn dashed — the only absence treatment. */
  readonly unopened: boolean;
};

export type OrbitField = {
  readonly bodies: readonly OrbitBody[];
  readonly groups: readonly OrbitGroup[];
  readonly electedThreadId: string | null;
  readonly awaitingCount: number;
  readonly liveCount: number;
};

function msOf(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The clock the field runs on: the newest fact in the graph, not the wall clock.
 *
 * Fixtures and session-created records then share one timeline, so a conversation
 * you just answered really is the innermost thing on screen.
 */
function readFieldClock(graph: ObjectGraph): number {
  let newest = 0;
  for (const message of graph.byKind('message')) {
    newest = Math.max(newest, msOf(field(message, 'createdAt')));
  }
  for (const thread of graph.byKind('thread')) {
    newest = Math.max(newest, msOf(field(thread, 'ts')));
  }
  return newest;
}

function bandFor(ageMs: number): TurnBand {
  for (const band of TURN_BANDS) {
    if (ageMs < BAND_CEILING_MS[band]) return band;
  }
  return 'quiet';
}

/** Messages of one thread, oldest first. */
export function messagesOf(graph: ObjectGraph, threadId: string): readonly ObjectRecord[] {
  return graph
    .relatedOfKind(threadId, 'contains', 'message')
    .slice()
    .sort((a, b) => msOf(field(a, 'createdAt')) - msOf(field(b, 'createdAt')));
}

/** The agent a conversation is with, if the thread names one. */
export function agentOf(graph: ObjectGraph, thread: ObjectRecord): ObjectRecord | null {
  return graph.relatedBy(thread.id, 'discusses').find((record) => record.kind === 'agent') ?? null;
}

/** The mission a conversation belongs to. Absent for a direct thread, which is normal. */
export function missionOf(graph: ObjectGraph, thread: ObjectRecord): ObjectRecord | null {
  return graph.relatedBy(thread.id, 'discusses').find((record) => record.kind === 'mission') ?? null;
}

/**
 * The one conversation allowed to be gold.
 *
 * The host elects a subject that is usually a decision request rather than a thread,
 * so the thread that carries that subject inherits the signal — and only that thread.
 */
function findElectedThreadId(
  graph: ObjectGraph,
  bodies: readonly OrbitBody[],
  attentionSubjectId: string | null,
): string | null {
  if (!attentionSubjectId) return null;

  const direct = bodies.find((body) => body.thread.id === attentionSubjectId);
  if (direct) return direct.thread.id;

  for (const body of bodies) {
    const carriesSubject = messagesOf(graph, body.thread.id).some((message) =>
      graph.relatedBy(message.id, 'references').some((record) => record.id === attentionSubjectId),
    );
    if (carriesSubject) return body.thread.id;
  }

  return null;
}

function buildBody(graph: ObjectGraph, thread: ObjectRecord, clock: number): OrbitBody {
  const messages = messagesOf(graph, thread.id);
  const last = messages.at(-1);
  const agent = agentOf(graph, thread);
  const mission = missionOf(graph, thread);
  const lastSpokenAt = last ? field(last, 'createdAt') : field(thread, 'ts');

  return {
    thread,
    agent,
    mission,
    groupId: mission?.id ?? 'direct',
    band: bandFor(clock - msOf(lastSpokenAt)),
    awaitingYou: last ? field(last, 'senderId') !== PRINCIPAL_ID : false,
    live: field(agent ?? undefined, 'status') === 'live',
    messageCount: messages.length,
    lastLine: last ? field(last, 'body') : '',
    lastSpokenAt,
    unopened: messages.length === 0,
  };
}

/** Groups ordered by their newest conversation, with direct threads leading. */
function buildGroups(bodies: readonly OrbitBody[]): readonly OrbitGroup[] {
  const groups = new Map<string, { label: string; standalone: boolean; count: number; newest: string }>();

  for (const body of bodies) {
    const existing = groups.get(body.groupId);
    if (existing) {
      existing.count += 1;
      if (body.lastSpokenAt > existing.newest) existing.newest = body.lastSpokenAt;
      continue;
    }
    groups.set(body.groupId, {
      label: body.mission?.title ?? 'Direct',
      standalone: body.mission === null,
      count: 1,
      newest: body.lastSpokenAt,
    });
  }

  return [...groups.entries()]
    .map(([id, group]) => ({ id, ...group }))
    .sort((a, b) => {
      if (a.standalone !== b.standalone) return a.standalone ? -1 : 1;
      return a.newest < b.newest ? 1 : -1;
    })
    .map(({ id, label, standalone, count }) => ({ id, label, standalone, count }));
}

/** Reads the Room's data once into the field every spatial lever is derived from. */
export function buildOrbitField(data: MessagesDesignData): OrbitField {
  const { graph, threads, attentionSubjectId } = data;
  const clock = readFieldClock(graph);

  const bodies = threads
    .map((thread) => buildBody(graph, thread, clock))
    .sort((a, b) => (a.lastSpokenAt < b.lastSpokenAt ? 1 : -1));

  return {
    bodies,
    groups: buildGroups(bodies),
    electedThreadId: findElectedThreadId(graph, bodies, attentionSubjectId),
    awaitingCount: bodies.filter((body) => body.awaitingYou).length,
    liveCount: bodies.filter((body) => body.live).length,
  };
}
