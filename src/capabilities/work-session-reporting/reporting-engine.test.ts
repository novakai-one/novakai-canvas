import { describe, expect, it } from 'vitest';
import {
  createReportingEngine,
  digestSchema,
  type ImportSessionInput,
  type ReceiptId,
  type ReportingSnapshot,
  type WorkSessionId,
} from './index';

const NOW = '2026-07-25T00:00:00.000Z';
const digest = (character: string) => `sha256:${character.repeat(64)}`;

function source(
  sourceDigest = digest('a'),
  complete = true,
  nativeSessionId = 'real-session-1',
): ImportSessionInput {
  return {
    provider: 'codex',
    nativeSessionId,
    sourceDigest,
    sourceRef: '/Users/private/.codex/sessions/real-session-1.jsonl',
    title: 'RAW FIXTURE PROMPT: build the visual report',
    startedAt: '2026-07-24T10:00:00.000Z',
    updatedAt: '2026-07-24T11:00:00.000Z',
    complete,
    warnings: [],
    events: [
      {
        providerEventId: 'event:1',
        role: 'user',
        timestamp: '2026-07-24T10:00:00.000Z',
        summary: 'RAW FIXTURE PROMPT: build the visual report',
      },
      {
        providerEventId: 'event:1',
        role: 'user',
        timestamp: '2026-07-24T10:00:00.000Z',
        summary: 'RAW FIXTURE PROMPT: build the visual report',
      },
    ],
  };
}

function setup(input = source()) {
  const reporting = createReportingEngine({ now: () => NOW });
  const imported = reporting.importSession(input);
  if (!imported.ok) throw new Error(imported.error.message);
  return { reporting, sessionId: imported.value.id };
}

function recordSuccessfulProof(
  reporting: ReturnType<typeof createReportingEngine>,
  sessionId: WorkSessionId,
) {
  return reporting.recordReceipt({
    sessionId,
    type: 'proof',
    title: 'Repository acceptance suite passed',
    summary: 'The command executed successfully.',
    occurredAt: NOW,
    evidence: [{ kind: 'test', label: 'npm run check', uri: 'command:npm-run-check' }],
    relatedModules: [],
    tags: ['verification'],
    proof: {
      command: 'npm run check',
      exitCode: 0,
      executedAt: NOW,
      outputDigest: digest('f'),
      outputExcerpt: '42 tests passed',
    },
  });
}

function compileComplete(
  reporting: ReturnType<typeof createReportingEngine>,
  sessionId: WorkSessionId,
) {
  const proof = recordSuccessfulProof(reporting, sessionId);
  if (!proof.ok) throw new Error(proof.error.message);
  return reporting.compileReport({
    sessionId,
    outcome: {
      status: 'complete',
      headline: 'The report pipeline works.',
      summary: 'One accepted projection serves two hosts.',
    },
    nextActions: [],
  });
}

function accept(
  reporting: ReturnType<typeof createReportingEngine>,
  draft: { id: string; sourceDigest: string; receiptsDigest: string },
) {
  return reporting.acceptReport({
    reportRevisionId: draft.id,
    expectedSourceDigest: draft.sourceDigest,
    expectedReceiptsDigest: draft.receiptsDigest,
  });
}

describe('work-session reporting public contract', () => {
  it('runtime-validates unknown external input and strict digests', () => {
    const reporting = createReportingEngine();
    expect(reporting.importSession({ provider: 'codex' })).toMatchObject({
      ok: false,
      error: { code: 'ValidationFailed' },
    });
    expect(digestSchema.safeParse('sha256:abcd').success).toBe(false);
    expect(digestSchema.safeParse(digest('a')).success).toBe(true);
  });

  it('imports exact retries idempotently and rejects conflicting duplicate provider ids', () => {
    const reporting = createReportingEngine({ now: () => NOW });
    const first = reporting.importSession(source());
    const second = reporting.importSession(source());
    expect(first).toEqual(second);
    expect(first.ok && first.value.events).toHaveLength(1);
    expect(reporting.snapshot().sessions).toHaveLength(1);

    const conflicting = source();
    conflicting.events[1] = {
      ...conflicting.events[1]!,
      summary: 'different content under the same provider identity',
    };
    expect(reporting.importSession(conflicting)).toMatchObject({
      ok: false,
      error: { code: 'IdentityConflict' },
    });
  });

  it('uses collision-safe durable identities for the reproduced FNV collision', () => {
    const reporting = createReportingEngine({ now: () => NOW });
    const first = reporting.importSession(source(digest('a'), true, 'candidate-75797'));
    const second = reporting.importSession(source(digest('b'), true, 'candidate-308040'));
    if (!first.ok || !second.ok) throw new Error('fixture import failed');
    expect(first.value.id).toBe(
      'session:fa094aafdf641bebb0878159c3a395b24bb9812f1bd0f5dc2e19f7dfd1363f55',
    );
    expect(second.value.id).toBe(
      'session:4d74e49ab586eab4e7dfbb16e4f74ef425b43ba9fe1cf2a757a9bf3936b3737b',
    );
    expect(reporting.snapshot().sessions).toHaveLength(2);
  });

  it('compiles deterministically and preserves projection bytes during acceptance', () => {
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
    const first = compileComplete(reporting, sessionId);
    const second = reporting.compileReport({
      sessionId,
      outcome: {
        status: 'complete',
        headline: 'The report pipeline works.',
        summary: 'One accepted projection serves two hosts.',
      },
      nextActions: [],
    });
    expect(first).toEqual(second);
    if (!first.ok) throw new Error(first.error.message);
    const projectionBefore = JSON.stringify(first.value.projection);
    const accepted = accept(reporting, first.value);
    const retried = accept(reporting, first.value);
    expect(accepted).toEqual(retried);
    expect(accepted.ok && JSON.stringify(accepted.value.projection)).toBe(projectionBefore);
    expect(first.value.receiptsDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.value.projectionDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('rejects source-stale acceptance without changing accepted truth', () => {
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
    expect(reporting.importSession(source(digest('b'))).ok).toBe(true);
    expect(accept(reporting, draft.value)).toMatchObject({
      ok: false,
      error: {
        code: 'StaleDraft',
        currentSourceDigest: digest('b'),
      },
    });
    expect(reporting.listReports()).toHaveLength(0);
  });

  it('rejects receipt-stale acceptance and makes prior acceptance unavailable after new evidence', () => {
    const { reporting, sessionId } = setup();
    const draft = reporting.compileReport({
      sessionId,
      outcome: {
        status: 'partial',
        headline: 'Evidence can still change.',
        summary: 'A receipt mutation should invalidate this candidate.',
      },
      nextActions: [],
    });
    if (!draft.ok) throw new Error(draft.error.message);
    expect(reporting.recordReceipt({
      sessionId,
      type: 'decision',
      title: 'New evidence',
      summary: 'This arrived after compilation.',
      occurredAt: NOW,
      evidence: [],
      relatedModules: [],
      tags: [],
    }).ok).toBe(true);
    expect(accept(reporting, draft.value)).toMatchObject({
      ok: false,
      error: { code: 'StaleReceipts' },
    });

    const fresh = reporting.compileReport({
      sessionId,
      outcome: {
        status: 'partial',
        headline: 'Fresh evidence.',
        summary: 'This revision includes current receipts.',
      },
      nextActions: [],
    });
    if (!fresh.ok) throw new Error(fresh.error.message);
    expect(accept(reporting, fresh.value).ok).toBe(true);
    expect(reporting.readProjection(sessionId).ok).toBe(true);
    expect(reporting.recordReceipt({
      sessionId,
      type: 'artifact',
      title: 'Post-accept evidence',
      summary: 'Accepted truth must now be unavailable.',
      occurredAt: NOW,
      evidence: [],
      relatedModules: [],
      tags: [],
    }).ok).toBe(true);
    expect(reporting.readProjection(sessionId)).toMatchObject({
      ok: false,
      error: { code: 'ReportNotFound' },
    });
    expect(reporting.readReport(fresh.value.id).ok).toBe(true);
  });

  it('enforces explicit completion, parser warnings, executed proof, blockers, and next actions', () => {
    const incomplete = setup(source(digest('c'), false));
    expect(incomplete.reporting.compileReport({
      sessionId: incomplete.sessionId,
      outcome: { status: 'partial', headline: 'Incomplete.', summary: 'No terminal signal.' },
      nextActions: [],
    })).toMatchObject({ ok: false, error: { code: 'IncompleteSession' } });

    const warningSource = source(digest('d'));
    warningSource.warnings = [{
      code: 'UnsupportedContent',
      line: 3,
      message: 'A block was dropped.',
    }];
    const warned = setup(warningSource);
    recordSuccessfulProof(warned.reporting, warned.sessionId);
    expect(warned.reporting.compileReport({
      sessionId: warned.sessionId,
      outcome: { status: 'complete', headline: 'Unsafe.', summary: 'Warning remains.' },
      nextActions: [],
    })).toMatchObject({ ok: false, error: { code: 'CompletionPolicyFailed' } });

    const noProof = setup(source(digest('e')));
    expect(noProof.reporting.compileReport({
      sessionId: noProof.sessionId,
      outcome: { status: 'complete', headline: 'Unproved.', summary: 'No executed proof.' },
      nextActions: [],
    })).toMatchObject({ ok: false, error: { code: 'CompletionPolicyFailed' } });

    const blocked = setup(source(digest('1')));
    recordSuccessfulProof(blocked.reporting, blocked.sessionId);
    blocked.reporting.recordReceipt({
      sessionId: blocked.sessionId,
      type: 'blocker',
      title: 'Still blocked',
      summary: 'This blocker is unresolved.',
      occurredAt: NOW,
      evidence: [],
      relatedModules: [],
      tags: [],
    });
    expect(blocked.reporting.compileReport({
      sessionId: blocked.sessionId,
      outcome: { status: 'complete', headline: 'Blocked.', summary: 'Cannot be complete.' },
      nextActions: [{ id: 'next', label: 'Do work', status: 'next', dependsOn: [] }],
    })).toMatchObject({ ok: false, error: { code: 'CompletionPolicyFailed' } });
  });

  it('requires proof receipts to carry executed evidence', () => {
    const { reporting, sessionId } = setup();
    expect(reporting.recordReceipt({
      sessionId,
      type: 'proof',
      title: 'Trust me',
      summary: 'No command was run.',
      occurredAt: NOW,
      evidence: [],
      relatedModules: [],
      tags: [],
    })).toMatchObject({ ok: false, error: { code: 'ValidationFailed' } });
  });

  it('clones and freezes inputs, outputs, queries, and snapshots', () => {
    const input = source();
    const reporting = createReportingEngine({ now: () => NOW });
    const imported = reporting.importSession(input);
    if (!imported.ok) throw new Error(imported.error.message);
    input.events[0]!.summary = 'caller mutation';
    expect(imported.value.events[0]!.summary).toContain('RAW FIXTURE');
    expect(Object.isFrozen(imported.value)).toBe(true);
    expect(Object.isFrozen(imported.value.events)).toBe(true);
    expect(() => {
      (imported.value.events as ImportSessionInput['events']).push(input.events[0]!);
    }).toThrow();
    const snapshot = reporting.snapshot();
    expect(Object.isFrozen(snapshot.sessions)).toBe(true);
    expect(reporting.snapshot().sessions[0]!.events).toHaveLength(1);
  });

  it('rejects duplicate identities, dangling references, projection disagreement, and duplicate accepted keys on hydration', () => {
    const { reporting, sessionId } = setup();
    const draft = reporting.compileReport({
      sessionId,
      outcome: { status: 'partial', headline: 'Hydration.', summary: 'Integrity checks.' },
      nextActions: [],
    });
    if (!draft.ok) throw new Error(draft.error.message);
    const accepted = accept(reporting, draft.value);
    if (!accepted.ok) throw new Error(accepted.error.message);
    const base = structuredClone(reporting.snapshot());

    const duplicateSession = structuredClone(base);
    duplicateSession.sessions.push(structuredClone(duplicateSession.sessions[0]!));
    expect(() => createReportingEngine({ initialSnapshot: duplicateSession }))
      .toThrow(/Duplicate session id/);

    const danglingReceipt = structuredClone(base);
    danglingReceipt.receipts.push({
      schemaVersion: 1,
      id: `receipt:${'1'.repeat(64)}` as ReceiptId,
      kind: 'work-receipt',
      createdAt: NOW,
      sessionId: `session:${'2'.repeat(64)}` as WorkSessionId,
      sourceDigest: digest('a'),
      type: 'artifact',
      title: 'Dangling',
      summary: 'Missing session.',
      occurredAt: NOW,
      evidence: [],
      relatedModules: [],
      tags: [],
    });
    expect(() => createReportingEngine({ initialSnapshot: danglingReceipt }))
      .toThrow(/missing session/);

    const disagreement = structuredClone(base);
    disagreement.acceptedReports[0]!.projection.reportRevisionId =
      `report:${'9'.repeat(64)}` as typeof disagreement.acceptedReports[0]['projection']['reportRevisionId'];
    expect(() => createReportingEngine({ initialSnapshot: disagreement }))
      .toThrow(/projection report id disagrees/);

    const danglingEdge = structuredClone(base);
    danglingEdge.acceptedReports[0]!.projection.changeMap.edges.push({
      id: 'edge:dangling',
      source: 'missing-node',
      target: 'also-missing',
      label: 'Invalid edge',
      kind: 'calls',
    });
    expect(() => createReportingEngine({ initialSnapshot: danglingEdge }))
      .toThrow(/dangling source/);

    const completionBypass = structuredClone(base);
    completionBypass.acceptedReports[0]!.projection.outcome.status = 'complete';
    expect(() => createReportingEngine({ initialSnapshot: completionBypass }))
      .toThrow(/without successful executed proof/);

    const duplicateKey = structuredClone(base);
    duplicateKey.acceptedReports.push(structuredClone(duplicateKey.acceptedReports[0]!));
    duplicateKey.acceptedReports[1]!.id =
      `report:${'8'.repeat(64)}` as typeof duplicateKey.acceptedReports[1]['id'];
    duplicateKey.acceptedReports[1]!.projection.reportRevisionId = duplicateKey.acceptedReports[1]!.id;
    expect(() => createReportingEngine({ initialSnapshot: duplicateKey }))
      .toThrow(/Duplicate accepted key/);
  });

  it('rehydrates the selected accepted revision for an independent second host', () => {
    const { reporting, sessionId } = setup();
    const draft = reporting.compileReport({
      sessionId,
      outcome: {
        status: 'partial',
        headline: 'Portable projection.',
        summary: 'The standalone consumer reads the same accepted bytes.',
      },
      nextActions: [],
    });
    if (!draft.ok) throw new Error(draft.error.message);
    const accepted = accept(reporting, draft.value);
    if (!accepted.ok) throw new Error(accepted.error.message);
    const secondHost = createReportingEngine({
      initialSnapshot: reporting.snapshot() as ReportingSnapshot,
    });
    expect(secondHost.readReport(accepted.value.id)).toEqual(reporting.readReport(accepted.value.id));
    expect(secondHost.readProjection(sessionId)).toEqual(reporting.readProjection(sessionId));
  });
});
