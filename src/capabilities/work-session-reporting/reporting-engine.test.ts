import { describe, expect, it } from 'vitest';
import {
  createReportingEngine,
  type ImportSessionInput,
  type WorkSessionId,
} from './index';

const NOW = '2026-07-25T00:00:00.000Z';

function source(
  digest = 'sha256:aaaaaaaa',
  complete = true,
): ImportSessionInput {
  return {
    provider: 'codex',
    nativeSessionId: 'real-session-1',
    sourceDigest: digest,
    sourceRef: '$CODEX/sessions/real-session-1.jsonl',
    title: 'Build visual work-session reporting',
    startedAt: '2026-07-24T10:00:00.000Z',
    updatedAt: '2026-07-24T11:00:00.000Z',
    complete,
    events: [
      {
        providerEventId: 'event:1',
        role: 'user',
        timestamp: '2026-07-24T10:00:00.000Z',
        summary: 'Build the visual report.',
      },
      {
        providerEventId: 'event:1',
        role: 'user',
        timestamp: '2026-07-24T10:00:00.000Z',
        summary: 'Duplicate must disappear.',
      },
    ],
  };
}

function setup() {
  const reporting = createReportingEngine({ now: () => NOW });
  const imported = reporting.importSession(source());
  if (!imported.ok) throw new Error(imported.error.message);
  return { reporting, sessionId: imported.value.id };
}

describe('work-session reporting public contract', () => {
  it('runtime-validates unknown external input', () => {
    const reporting = createReportingEngine();
    const result = reporting.importSession({ provider: 'codex' });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'ValidationFailed' },
    });
  });

  it('imports a source idempotently and deduplicates provider event identities', () => {
    const reporting = createReportingEngine({ now: () => NOW });
    const first = reporting.importSession(source());
    const second = reporting.importSession(source());
    expect(first).toEqual(second);
    expect(first.ok && first.value.events).toHaveLength(1);
    expect(reporting.snapshot().sessions).toHaveLength(1);
  });

  it('compiles deterministically and accepts exactly one report for a source version', () => {
    const { reporting, sessionId } = setup();
    const receipt = reporting.recordReceipt({
      sessionId,
      type: 'change',
      title: 'Introduce reporting authority',
      summary: 'One core now owns report acceptance.',
      occurredAt: NOW,
      module: { id: 'reporting', label: 'Reporting core', role: 'module' },
      relatedModules: [{ id: 'canvas', label: 'Canvas host', role: 'caller' }],
      evidence: [{ kind: 'test', label: 'Contract test', uri: 'test:reporting-contract' }],
      tags: ['core'],
    });
    expect(receipt.ok).toBe(true);
    const command = {
      sessionId,
      outcome: {
        status: 'complete' as const,
        headline: 'The report pipeline works.',
        summary: 'One accepted projection serves two hosts.',
      },
      nextActions: [],
    };
    const first = reporting.compileReport(command);
    const second = reporting.compileReport(command);
    expect(first).toEqual(second);
    if (!first.ok) throw new Error(first.error.message);
    const accepted = reporting.acceptReport({
      reportRevisionId: first.value.id,
      expectedSourceDigest: first.value.sourceDigest,
    });
    const retried = reporting.acceptReport({
      reportRevisionId: first.value.id,
      expectedSourceDigest: first.value.sourceDigest,
    });
    expect(accepted).toEqual(retried);
    expect(reporting.listReports()).toHaveLength(1);
    const projection = reporting.readProjection(sessionId);
    if (!projection.ok) throw new Error(projection.error.message);
    expect(projection.value.changeMap.nodes).toHaveLength(2);
  });

  it('rejects stale acceptance without changing the accepted report set', () => {
    const { reporting, sessionId } = setup();
    const draft = reporting.compileReport({
      sessionId,
      outcome: {
        status: 'partial',
        headline: 'Draft before source mutation.',
        summary: 'The session will change before acceptance.',
      },
      nextActions: [],
    });
    if (!draft.ok) throw new Error(draft.error.message);
    const changed = reporting.importSession(source('sha256:bbbbbbbb'));
    expect(changed.ok).toBe(true);
    expect(reporting.acceptReport({
      reportRevisionId: draft.value.id,
      expectedSourceDigest: draft.value.sourceDigest,
    })).toMatchObject({
      ok: false,
      error: {
        code: 'StaleDraft',
        currentSourceDigest: 'sha256:bbbbbbbb',
      },
    });
    expect(reporting.listReports()).toHaveLength(0);
  });

  it('blocks compilation of an incomplete source', () => {
    const reporting = createReportingEngine({ now: () => NOW });
    const imported = reporting.importSession(source('sha256:cccccccc', false));
    if (!imported.ok) throw new Error(imported.error.message);
    expect(reporting.compileReport({
      sessionId: imported.value.id,
      outcome: {
        status: 'blocked',
        headline: 'Incomplete source.',
        summary: 'The adapter reported partial data.',
      },
      nextActions: [],
    })).toMatchObject({
      ok: false,
      error: { code: 'IncompleteSession' },
    });
  });

  it('rehydrates the same accepted projection for a second host', () => {
    const { reporting, sessionId } = setup();
    const draft = reporting.compileReport({
      sessionId,
      outcome: {
        status: 'complete',
        headline: 'Portable projection.',
        summary: 'The standalone consumer reads the same public snapshot.',
      },
      nextActions: [],
    });
    if (!draft.ok) throw new Error(draft.error.message);
    const accepted = reporting.acceptReport({
      reportRevisionId: draft.value.id,
      expectedSourceDigest: draft.value.sourceDigest,
    });
    if (!accepted.ok) throw new Error(accepted.error.message);
    const secondHost = createReportingEngine({ initialSnapshot: reporting.snapshot() });
    expect(secondHost.readProjection(sessionId as WorkSessionId)).toEqual(
      reporting.readProjection(sessionId),
    );
  });
});
