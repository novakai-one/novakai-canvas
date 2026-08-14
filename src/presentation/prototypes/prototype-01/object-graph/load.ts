/**
 * Reads the fixture stores and normalises them into one shape.
 *
 * The stores use three different identifier conventions — `id`, a bespoke `<kind>Id`,
 * and an `{envelope, payload, meta}` wrapper. That is a fact about the repository, not
 * a problem to redesign, so this module is the single seam that reconciles them. Past
 * this file nothing in the application knows those conventions exist.
 */
import type { ObjectKind, ObjectRecord, Ref } from './contract';

const RAW = import.meta.glob('../data/*.jsonl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The bespoke identifier key each convention-B store uses, by store name. */
const BESPOKE_ID: Record<string, string> = {
  stages: 'stageId',
  steps: 'stepId',
  loops: 'loopId',
  agentRuns: 'agentRunId',
  teamSeats: 'teamSeatId',
  notifications: 'notificationId',
  evidence: 'evidenceId',
  messages: 'messageId',
};

/** Where each store's human-facing title lives, in preference order. */
const TITLE_KEYS = ['title', 'name', 'goal', 'claim', 'question', 'body', 'prompt'];

function storeNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace('.jsonl', '');
}

function firstString(source: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

/**
 * Normalises the two ref spellings this repository actually uses.
 *
 * `refs[]` carries `{kind, value}`; `subjectRef` carries `{kind, id}`. Accepting both
 * here is cheaper and more honest than rewriting fixtures to agree.
 */
function normaliseRefs(source: Record<string, unknown>): Ref[] {
  const out: Ref[] = [];
  const refs = source.refs;
  if (Array.isArray(refs)) {
    for (const entry of refs) {
      if (entry && typeof entry === 'object') {
        const ref = entry as Record<string, unknown>;
        const value = ref.value ?? ref.id;
        if (typeof ref.kind === 'string' && typeof value === 'string' && value) {
          out.push({ kind: ref.kind, value });
        }
      }
    }
  }
  const subject = source.subjectRef;
  if (subject && typeof subject === 'object') {
    const ref = subject as Record<string, unknown>;
    const value = ref.value ?? ref.id;
    if (typeof ref.kind === 'string' && typeof value === 'string' && value) {
      out.push({ kind: ref.kind, value });
    }
  }
  return out;
}

function normalise(store: string, line: Record<string, unknown>): ObjectRecord | null {
  // Convention C: the record is wrapped, and identity lives on the envelope.
  const envelope = line.envelope as Record<string, unknown> | undefined;
  if (envelope && typeof envelope.id === 'string') {
    const payload = (line.payload ?? {}) as Record<string, unknown>;
    return {
      id: envelope.id,
      kind: envelope.kind as ObjectKind,
      title: firstString(payload, TITLE_KEYS) || envelope.id,
      createdAt: String(envelope.createdAt ?? ''),
      fields: { ...payload, __envelope: envelope, __meta: line.meta },
      refs: normaliseRefs(payload),
    };
  }

  // Conventions A and B differ only in which key carries the identity.
  const idKey = BESPOKE_ID[store] ?? 'id';
  const id = line[idKey];
  if (typeof id !== 'string' || !id) return null;
  const kind = line.kind;
  if (typeof kind !== 'string') return null;

  return {
    id,
    kind: kind as ObjectKind,
    title: firstString(line, TITLE_KEYS) || id,
    createdAt: String(line.ts ?? line.createdAt ?? line.startedAt ?? ''),
    fields: line,
    refs: normaliseRefs(line),
  };
}

/**
 * Names the objects whose stores hold no name of their own.
 *
 * A seat, a run, a notification and a pin are all real objects with no title field —
 * their identity comes from what they point at. Without this pass their raw IDs leak
 * into the interface, which is exactly the "names are presentation data" rule failing
 * in the visible direction.
 */
function resolveTitles(records: ObjectRecord[]): ObjectRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const nameOf = (id: unknown): string =>
    typeof id === 'string' ? (byId.get(id)?.title ?? '') : '';

  return records.map((record) => {
    if (record.title !== record.id) return record;
    const subject = record.fields.subjectRef as { id?: string } | undefined;
    const title =
      record.kind === 'teamSeat'
        ? `${nameOf(record.fields.roleProfileId) || 'Unassigned'} seat`
        : record.kind === 'agentRun'
          ? `${nameOf(record.fields.agentId) || 'Agent'} on ${nameOf(record.fields.taskId) || 'a task'}`
          : record.kind === 'notification'
            ? `Notice about ${nameOf(subject?.id) || 'an object'}`
            : record.kind === 'pin'
              ? nameOf(subject?.id) || record.title
              : record.title;
    return title === record.title ? record : { ...record, title };
  });
}

/**
 * Parses every fixture store. A line that will not parse is skipped rather than thrown:
 * one bad line should cost one object, not the whole application.
 */
export function loadFixtures(): { records: ObjectRecord[]; skipped: string[] } {
  const records: ObjectRecord[] = [];
  const skipped: string[] = [];

  for (const [path, text] of Object.entries(RAW)) {
    const store = storeNameOf(path);
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        skipped.push(`${store}.jsonl line ${index + 1}: not valid JSON`);
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;
      const record = normalise(store, parsed as Record<string, unknown>);
      if (record) records.push(record);
      else skipped.push(`${store}.jsonl line ${index + 1}: no usable identity`);
    });
  }

  return { records: resolveTitles(records), skipped };
}
