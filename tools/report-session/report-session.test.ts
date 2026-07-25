import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createReportingEngine,
  publishedAcceptedReportEnvelopeSchema,
  reportingSnapshotSchema,
  type WorkSessionId,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { parseCodexSessionFile } from './codex-session-source.ts';
import { reportGenerationPolicy } from './generation-policy.ts';
import { renderStandaloneReport } from './html-renderer.ts';
import {
  createPublishedEnvelope,
  createPublishedProjection,
  verifyPublishedEnvelope,
} from './publish-report.ts';
import { collectRepositoryReceipts } from './repository-evidence.ts';

const repoRoot = new URL('../..', import.meta.url).pathname;
const fixture = new URL('./fixtures/codex-session.jsonl', import.meta.url).pathname;
const cli = new URL('./cli.ts', import.meta.url).pathname;
const NOW = '2026-07-25T00:00:00.000Z';
const TEST_EVIDENCE_HEAD = {
  commit: '1'.repeat(40),
  tree: '2'.repeat(40),
};

function digestBytes(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function resignEnvelope(
  envelope: ReturnType<typeof createPublishedEnvelope>,
  html: string,
) {
  const resigned = structuredClone(envelope);
  resigned.publicProjectionDigest = digestBytes(canonical(resigned.projection));
  resigned.html.digest = digestBytes(html);
  const { publicationDigest: _publicationDigest, ...unsigned } = resigned;
  resigned.publicationDigest = digestBytes(canonical(unsigned));
  return resigned;
}

function privateTemp(prefix: string): string {
  const root = join(repoRoot, '.novakai-reports');
  mkdirSync(root, { recursive: true });
  return mkdtempSync(join(root, prefix));
}

function prepareAcceptedReport() {
  const reporting = createReportingEngine({ now: () => NOW });
  const imported = reporting.importSession(parseCodexSessionFile(fixture, { confirmComplete: true }));
  if (!imported.ok) throw new Error(imported.error.message);
  const receipt = reporting.recordReceipt({
    sessionId: imported.value.id,
    type: 'artifact',
    title: 'Artifact at /Users/private/project/report.html',
    summary: 'Stored under $HOME/private with no transcript payload.',
    occurredAt: NOW,
    evidence: [{
      kind: 'file',
      label: '/Users/private/project/report.html',
      uri: 'file:///Users/private/project/report.html',
    }],
    relatedModules: [],
    tags: [],
  });
  if (!receipt.ok) throw new Error(receipt.error.message);
  const draft = reporting.compileReport({
    sessionId: imported.value.id,
    outcome: {
      status: 'partial',
      headline: '<One report & two hosts>',
      summary: 'The standalone renderer receives only a redacted projection.',
    },
    nextActions: [],
  });
  if (!draft.ok) throw new Error(draft.error.message);
  const accepted = reporting.acceptReport({
    reportRevisionId: draft.value.id,
    expectedSourceDigest: draft.value.sourceDigest,
    expectedReceiptsDigest: draft.value.receiptsDigest,
  });
  if (!accepted.ok) throw new Error(accepted.error.message);
  return {
    report: accepted.value,
    receipts: reporting.snapshot().receipts,
  };
}

describe('report session adapters', () => {
  it('binds repository receipts to changed bytes even when the same paths changed', () => {
    const source = parseCodexSessionFile(fixture, { confirmComplete: true });
    const identityEngine = createReportingEngine({ now: () => NOW });
    const imported = identityEngine.importSession(source);
    if (!imported.ok) throw new Error(imported.error.message);
    const sessionId = imported.value.id as WorkSessionId;
    const olderBase = collectRepositoryReceipts({
      repoRoot,
      baseRef: '31792d15f564a67729535ca275dc56826a85750b',
      evidenceHeadRef: 'HEAD',
      sessionId,
    });
    const newerBase = collectRepositoryReceipts({
      repoRoot,
      baseRef: '283af7b',
      evidenceHeadRef: 'HEAD',
      sessionId,
    });

    expect(olderBase.map((receipt) => receipt.evidence.map((item) => item.uri))).not.toEqual(
      newerBase.map((receipt) => receipt.evidence.map((item) => item.uri)),
    );
    const record = (receipts: typeof olderBase) => {
      const reporting = createReportingEngine({ now: () => NOW });
      const session = reporting.importSession(source);
      if (!session.ok) throw new Error(session.error.message);
      const recorded = receipts.map((receipt) => {
        const result = reporting.recordReceipt(receipt);
        if (!result.ok) throw new Error(result.error.message);
        return result.value.id;
      });
      const draft = reporting.compileReport({
        sessionId,
        outcome: { status: 'partial', headline: 'Byte identity.', summary: 'Compare repository state.' },
        nextActions: [],
      });
      if (!draft.ok) throw new Error(draft.error.message);
      return { receiptIds: recorded, receiptsDigest: draft.value.receiptsDigest };
    };
    const olderIdentity = record(olderBase);
    const newerIdentity = record(newerBase);
    expect(olderIdentity.receiptIds).not.toEqual(newerIdentity.receiptIds);
    expect(olderIdentity.receiptsDigest).not.toBe(newerIdentity.receiptsDigest);
  }, 15_000);

  it('does not infer completion from valid JSON and accepts explicit completion confirmation', () => {
    const preview = parseCodexSessionFile(fixture);
    const completed = parseCodexSessionFile(fixture, { confirmComplete: true });
    expect(preview).toMatchObject({
      provider: 'codex',
      nativeSessionId: '22222222-2222-4222-8222-222222222222',
      complete: false,
      title: 'Build a visual work-session report.',
      warnings: [],
    });
    expect(completed.complete).toBe(true);
    expect(completed.events.map((event) => event.providerEventId)).toEqual([
      'message-user#0',
      'message-assistant#0',
    ]);
    expect(completed.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('returns typed warnings for malformed and unsupported content', () => {
    const directory = privateTemp('parser-test-');
    const path = join(directory, 'broken.jsonl');
    const unsupported = JSON.stringify({
      timestamp: NOW,
      type: 'response_item',
      payload: {
        type: 'message',
        id: 'unsupported-message',
        role: 'assistant',
        content: [{ type: 'image', url: 'private' }],
      },
    });
    writeFileSync(path, `${readFileSync(fixture, 'utf8')}${unsupported}\nnot-json\n`, 'utf8');
    expect(parseCodexSessionFile(path, { confirmComplete: true }).warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UnsupportedContent' }),
        expect.objectContaining({ code: 'MalformedLine' }),
      ]),
    );
  });

  it('denies unknown top-level and response-item types even when one event is valid', () => {
    const directory = privateTemp('top-level-content-test-');
    const path = join(directory, 'unsupported-top-level.jsonl');
    const metadata = JSON.stringify({
      timestamp: NOW,
      type: 'session_meta',
      payload: { id: 'top-level-content-session', timestamp: NOW },
    });
    const valid = JSON.stringify({
      timestamp: NOW,
      type: 'response_item',
      payload: {
        type: 'message',
        id: 'valid-message',
        role: 'user',
        content: [{ type: 'input_text', text: 'one valid normalized event' }],
      },
    });
    const unknownTopLevel = JSON.stringify({
      timestamp: NOW,
      type: 'future_user_record',
      payload: { body: 'content that silently disappears' },
    });
    const unknownResponseItem = JSON.stringify({
      timestamp: NOW,
      type: 'response_item',
      payload: { type: 'future_content', body: 'content that silently disappears' },
    });
    writeFileSync(
      path,
      `${metadata}\n${valid}\n${unknownTopLevel}\n${unknownResponseItem}\n`,
      'utf8',
    );

    const parsed = parseCodexSessionFile(path, { confirmComplete: true });
    expect(parsed.events).toHaveLength(1);
    expect(parsed.warnings).toEqual([
      {
        code: 'UnsupportedContent',
        line: 3,
        message: 'Unsupported top-level record type future_user_record.',
      },
      {
        code: 'UnsupportedContent',
        line: 4,
        message: 'Unsupported response item payload type future_content.',
      },
    ]);
    const reporting = createReportingEngine({ now: () => NOW });
    const imported = reporting.importSession(parsed);
    if (!imported.ok) throw new Error(imported.error.message);
    const proof = reporting.recordReceipt({
      sessionId: imported.value.id,
      type: 'proof',
      title: 'Parser warning gate proof',
      summary: 'A successful command cannot override an unsupported-record warning.',
      occurredAt: NOW,
      evidence: [{ kind: 'test', label: 'parser warning test', uri: 'test:parser-warning' }],
      relatedModules: [],
      tags: [],
      proof: {
        command: 'npm run check',
        exitCode: 0,
        executedAt: NOW,
        outputDigest: `sha256:${'1'.repeat(64)}`,
        outputExcerpt: 'passed',
      },
    });
    if (!proof.ok) throw new Error(proof.error.message);
    expect(reporting.compileReport({
      sessionId: imported.value.id,
      outcome: { status: 'complete', headline: 'Unsafe.', summary: 'Content disappeared.' },
      nextActions: [],
    })).toMatchObject({ ok: false, error: { code: 'CompletionPolicyFailed' } });
  });

  it('detects conflicting provider event identities at the parser and authority seams', () => {
    const directory = privateTemp('event-id-test-');
    const path = join(directory, 'collision.jsonl');
    const source = [
      JSON.stringify({
        timestamp: NOW,
        type: 'session_meta',
        payload: { id: 'duplicate-event-session', timestamp: NOW },
      }),
      JSON.stringify({
        timestamp: NOW,
        type: 'response_item',
        payload: {
          type: 'message',
          id: 'same-message',
          role: 'user',
          content: [{ type: 'input_text', text: 'first' }],
        },
      }),
      JSON.stringify({
        timestamp: NOW,
        type: 'response_item',
        payload: {
          type: 'message',
          id: 'same-message',
          role: 'user',
          content: [{ type: 'input_text', text: 'second' }],
        },
      }),
    ].join('\n');
    writeFileSync(path, `${source}\n`, 'utf8');
    const parsed = parseCodexSessionFile(path, { confirmComplete: true });
    expect(parsed.warnings).toContainEqual(expect.objectContaining({ code: 'ConflictingEventId' }));
    expect(createReportingEngine().importSession(parsed)).toMatchObject({
      ok: false,
      error: { code: 'IdentityConflict' },
    });
  });

  it('publishes deterministic redacted JSON and HTML without raw session truth', () => {
    const { report, receipts } = prepareAcceptedReport();
    const projection = createPublishedProjection(report, receipts);
    const html = renderStandaloneReport(projection);
    const envelope = createPublishedEnvelope(report, receipts, {
      path: `docs/visual-reporting/reports/${report.id.replace(':', '-')}.html`,
      content: html,
    }, TEST_EVIDENCE_HEAD);
    const publicBytes = `${JSON.stringify(envelope)}\n${html}`;
    expect(publishedAcceptedReportEnvelopeSchema.parse(envelope)).toEqual(envelope);
    expect(html).toContain('&lt;One report &amp; two hosts&gt;');
    expect(html).toContain(report.id);
    expect(html).toContain(report.sourceDigest);
    expect(html).not.toContain('<script');
    expect(renderStandaloneReport(projection)).toBe(html);
    expect(Object.isFrozen(envelope.projection.proofs)).toBe(true);
    for (const forbidden of [
      'Build a visual work-session report.',
      'I will establish one reporting authority',
      'sourceRef',
      '/Users/',
      '/home/',
      '$HOME',
      '$CODEX_HOME',
      '"events"',
      '"providerEventId"',
    ]) {
      expect(publicBytes, `must redact ${forbidden}`).not.toContain(forbidden);
    }
    expect(publicBytes).toContain('[redacted-path]');
    expect(verifyPublishedEnvelope(envelope, html)).toEqual(envelope);
    expect(() => verifyPublishedEnvelope({
      ...envelope,
      receiptsDigest: `sha256:${'0'.repeat(64)}`,
    }, html)).toThrow(/envelope digest/);
    expect(() => verifyPublishedEnvelope(envelope, `${html}\nchanged`)).toThrow(/HTML digest/);
  });

  it('redacts every supported home-path form from every public text surface', () => {
    const reporting = createReportingEngine({ now: () => NOW });
    const imported = reporting.importSession(parseCodexSessionFile(fixture, { confirmComplete: true }));
    if (!imported.ok) throw new Error(imported.error.message);
    const privateHomes = '/Users/alice/a /home/alice/b C:\\Users\\alice\\c $HOME/d $CODEX_HOME/e';
    const change = reporting.recordReceipt({
      sessionId: imported.value.id,
      type: 'change',
      title: `Change ${privateHomes}`,
      summary: `Summary ${privateHomes}`,
      occurredAt: NOW,
      module: {
        id: '/home/alice/map-id',
        label: '/home/alice/map-label',
        role: 'module',
      },
      relatedModules: [],
      evidence: [{
        kind: 'file',
        label: `/home/alice/evidence-label ${privateHomes}`,
        uri: 'file:///home/alice/private-source',
      }],
      tags: [],
    });
    if (!change.ok) throw new Error(change.error.message);
    const proof = reporting.recordReceipt({
      sessionId: imported.value.id,
      type: 'proof',
      title: 'Private proof',
      summary: `Proof summary ${privateHomes}`,
      occurredAt: NOW,
      evidence: [{
        kind: 'test',
        label: `/home/alice/proof-evidence ${privateHomes}`,
        uri: 'test:private-home-proof',
      }],
      relatedModules: [],
      tags: [],
      proof: {
        command: `cat /home/alice/proof-command ${privateHomes}`,
        exitCode: 0,
        executedAt: NOW,
        outputDigest: `sha256:${'4'.repeat(64)}`,
        outputExcerpt: `proof output text /home/alice/proof-output ${privateHomes}`,
      },
    });
    if (!proof.ok) throw new Error(proof.error.message);
    const draft = reporting.compileReport({
      sessionId: imported.value.id,
      outcome: {
        status: 'partial',
        headline: `Title ${privateHomes}`,
        summary: `Outcome ${privateHomes}`,
      },
      nextActions: [{
        id: '/home/alice/next-id',
        label: `Next ${privateHomes}`,
        status: 'next',
        dependsOn: ['/home/alice/dependency'],
      }],
    });
    if (!draft.ok) throw new Error(draft.error.message);
    const accepted = reporting.acceptReport({
      reportRevisionId: draft.value.id,
      expectedSourceDigest: draft.value.sourceDigest,
      expectedReceiptsDigest: draft.value.receiptsDigest,
    });
    if (!accepted.ok) throw new Error(accepted.error.message);
    const receipts = reporting.snapshot().receipts;
    const projection = createPublishedProjection(accepted.value, receipts);
    const html = renderStandaloneReport(projection);
    const envelope = createPublishedEnvelope(accepted.value, receipts, {
      path: `docs/visual-reporting/reports/${accepted.value.id.replace(':', '-')}.html`,
      content: html,
    }, TEST_EVIDENCE_HEAD);
    const publicBytes = `${JSON.stringify(envelope)}\n${html}`;

    for (const forbidden of ['/Users/', '/home/', 'C:\\Users\\', '$HOME', '$CODEX_HOME']) {
      expect(publicBytes, `must redact ${forbidden}`).not.toContain(forbidden);
    }
    expect(publicBytes).not.toContain('proof output text');
    expect(projection.title).toContain('[redacted-path]');
    expect(projection.outcome.summary).toContain('[redacted-path]');
    expect(projection.evidence[0]?.label).toContain('[redacted-path]');
    expect(projection.proofs[0]?.proof?.command).toContain('[redacted-path]');
    expect(projection.changeMap.nodes[0]).toMatchObject({
      id: '[redacted-path]',
      label: '[redacted-path]',
    });
    expect(projection.workflow.at(-1)).toMatchObject({
      id: '[redacted-path]',
      label: expect.stringContaining('[redacted-path]'),
      detail: expect.stringContaining('[redacted-path]'),
    });
    expect(projection.nextActions[0]).toMatchObject({
      id: '[redacted-path]',
      label: expect.stringContaining('[redacted-path]'),
      dependsOn: ['[redacted-path]'],
    });
    expect(verifyPublishedEnvelope(envelope, html)).toEqual(envelope);
  });

  it('rejects the exact public revision/count tamper and non-renderer HTML after digest recomputation', () => {
    const { report, receipts } = prepareAcceptedReport();
    const projection = createPublishedProjection(report, receipts);
    const html = renderStandaloneReport(projection);
    const envelope = createPublishedEnvelope(report, receipts, {
      path: `docs/visual-reporting/reports/${report.id.replace(':', '-')}.html`,
      content: html,
    }, TEST_EVIDENCE_HEAD);

    const tamperedProjection = structuredClone(envelope);
    tamperedProjection.projection.reportRevisionId =
      `report:${'0'.repeat(64)}` as typeof tamperedProjection.projection.reportRevisionId;
    tamperedProjection.projection.stats.changes = 999;
    const tamperedHtml = renderStandaloneReport(tamperedProjection.projection);
    const resignedProjection = resignEnvelope(tamperedProjection, tamperedHtml);
    expect(() => verifyPublishedEnvelope(resignedProjection, tamperedHtml))
      .toThrow(/report revision|change count/);

    const hostileHtml = `${html}\n<!-- attacker supplied bytes -->`;
    const resignedHtml = resignEnvelope(envelope, hostileHtml);
    expect(() => verifyPublishedEnvelope(resignedHtml, hostileHtml))
      .toThrow(/deterministic renderer output/);
  });

  it('rejects a manufactured public proof copy that lacks an authoritative proof claim', () => {
    const { report, receipts } = prepareAcceptedReport();
    const forgedReport = structuredClone(report);
    const authoritativeArtifact = forgedReport.projection.artifacts[0]!;
    forgedReport.projection.proofs = [{
      ...authoritativeArtifact,
      type: 'proof',
      proof: {
        command: 'npm run check',
        exitCode: 0,
        executedAt: NOW,
        outputDigest: `sha256:${'f'.repeat(64)}`,
        outputExcerpt: 'forged',
      },
    }];
    expect(() => createPublishedProjection(forgedReport, receipts))
      .toThrow(/proof copies disagree with authoritative receipts/);

    const projection = createPublishedProjection(report, receipts);
    const html = renderStandaloneReport(projection);
    const envelope = createPublishedEnvelope(report, receipts, {
      path: `docs/visual-reporting/reports/${report.id.replace(':', '-')}.html`,
      content: html,
    }, TEST_EVIDENCE_HEAD);
    const hostile = structuredClone(envelope);
    const artifact = hostile.projection.artifacts[0]!;
    hostile.projection.artifacts = [];
    hostile.projection.proofs = [{
      ...artifact,
      type: 'proof',
      proof: {
        command: 'npm run check',
        exitCode: 0,
        executedAt: NOW,
        outputDigest: `sha256:${'f'.repeat(64)}`,
      },
    }];
    hostile.projection.stats.artifacts = 0;
    hostile.projection.stats.proofs = 1;
    hostile.projection.outcome.status = 'complete';
    const hostileHtml = renderStandaloneReport(hostile.projection);
    const resigned = resignEnvelope(hostile, hostileHtml);
    expect(() => verifyPublishedEnvelope(resigned, hostileHtml))
      .toThrow(/authoritative claim/);
  });

  it('keeps the checked-in public envelope and selected HTML free of private source truth', () => {
    const envelopePath = join(repoRoot, 'public/reports/accepted-report.json');
    const envelope = publishedAcceptedReportEnvelopeSchema.parse(
      JSON.parse(readFileSync(envelopePath, 'utf8')),
    );
    const html = readFileSync(join(repoRoot, envelope.html.path), 'utf8');
    const publicBytes = `${readFileSync(envelopePath, 'utf8')}\n${html}`;
    expect(verifyPublishedEnvelope(envelope, html)).toEqual(envelope);
    for (const forbidden of [
      'Build a visual work-session report.',
      'I will establish one reporting authority',
      'sourceRef',
      '/Users/',
      '/home/',
      '$HOME',
      '$CODEX_HOME',
      '"events"',
      '"providerEventId"',
      'poc-reporting-state.json',
      '.jsonl',
    ]) {
      expect(publicBytes, `checked-in publication must redact ${forbidden}`).not.toContain(forbidden);
    }
    expect(envelope.projection.changeDetails).toHaveLength(5);
    expect(envelope.projection.changeDetails?.map((receipt) => receipt.title)).toContain(
      'Give agents a source-bound end-session receipt',
    );
    expect(html).toContain('What changed — before → after?');
    expect(html).toContain('Proof is structurally impossible');
  });

  it('keeps every checked-in v1 standalone report byte-for-byte immutable', () => {
    const immutableV1Reports = {
      'docs/visual-reporting/reports/report-71adacbefcd482ba0d120cbcc662f32d8de8d97e8eadc3a1ffeac0abed802ce6.html':
        'sha256:22e43ead9f1a95cf08cc5d6e23fcf4937ef50534bcb148bd2cddcdb23fea67c5',
      'docs/visual-reporting/reports/report-dcc4a98d5d37a06d481f8f720a033b302336c5bd515db1a0f2aa6beecdbd6779.html':
        'sha256:6e3365728d19ce431030d66b0373b6adfbbd1c9555d1e0e9cc47fa3b69d470c6',
    };
    for (const [path, expectedDigest] of Object.entries(immutableV1Reports)) {
      expect(digestBytes(readFileSync(join(repoRoot, path), 'utf8')), path)
        .toBe(expectedDigest);
    }
  });

  it('retains private history, publishes one atomic revision pointer, and shows the selected report', () => {
    const directory = privateTemp('cli-test-');
    const state = join(directory, 'state.json');
    const publicEnvelope = join(directory, 'accepted-report.json');
    const htmlDirectory = join(directory, 'html');
    const secondSession = join(directory, 'second.jsonl');
    writeFileSync(
      secondSession,
      readFileSync(fixture, 'utf8')
        .replaceAll('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')
        .replace('Build a visual work-session report.', 'Build the second report.'),
      'utf8',
    );

    for (const session of [fixture, secondSession]) {
      execFileSync(process.execPath, [
        cli,
        'generate',
        '--session',
        session,
        '--complete',
        '--state',
        state,
        '--public',
        publicEnvelope,
        '--html-directory',
        htmlDirectory,
      ], { cwd: repoRoot, encoding: 'utf8' });
    }

    const snapshot = reportingSnapshotSchema.parse(JSON.parse(readFileSync(state, 'utf8')));
    const envelope = publishedAcceptedReportEnvelopeSchema.parse(
      JSON.parse(readFileSync(publicEnvelope, 'utf8')),
    );
    const html = readFileSync(join(htmlDirectory, basename(envelope.html.path)), 'utf8');
    expect(snapshot.sessions).toHaveLength(2);
    expect(snapshot.acceptedReports).toHaveLength(2);
    expect(snapshot.revision).toBeGreaterThan(0);
    expect(html).toContain(envelope.reportRevisionId);
    expect(html).toContain(envelope.sourceDigest);

    const shown = JSON.parse(execFileSync(process.execPath, [
      cli,
      'show',
      '--public',
      publicEnvelope,
      '--html-directory',
      htmlDirectory,
      '--report',
      envelope.reportRevisionId,
    ], { cwd: repoRoot, encoding: 'utf8' })) as {
      reportRevisionId: string;
      evidenceHead: { commit: string; tree: string };
    };
    expect(shown.reportRevisionId).toBe(envelope.reportRevisionId);
    expect(shown.evidenceHead).toEqual(envelope.evidenceHead);
    const staleSelection = spawnSync(process.execPath, [
      cli,
      'show',
      '--public',
      publicEnvelope,
      '--html-directory',
      htmlDirectory,
      '--report',
      `report:${'0'.repeat(64)}`,
    ], { cwd: repoRoot, encoding: 'utf8' });
    expect(staleSelection.status).toBe(1);
    expect(staleSelection.stderr).toContain('not available');
  }, 15_000);

  it('names the intended evidence commit and repeats generation byte-idempotently', () => {
    const directory = privateTemp('final-idempotency-test-');
    const state = join(directory, 'state.json');
    const publicEnvelope = join(directory, 'accepted-report.json');
    const htmlDirectory = join(directory, 'html');
    const evidenceCommit = execFileSync('git', ['rev-parse', 'HEAD^{commit}'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    const evidenceTree = execFileSync('git', ['rev-parse', `${evidenceCommit}^{tree}`], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    const args = [
      cli,
      'generate',
      '--session',
      fixture,
      '--complete',
      '--evidence-head',
      evidenceCommit,
      '--state',
      state,
      '--public',
      publicEnvelope,
      '--html-directory',
      htmlDirectory,
    ];
    const trackedBefore = execFileSync('git', ['status', '--short'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const first = JSON.parse(execFileSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
    })) as { reportRevisionId: string; html: string };
    const firstEnvelope = readFileSync(publicEnvelope, 'utf8');
    const firstHtml = readFileSync(join(repoRoot, first.html), 'utf8');
    const firstState = readFileSync(state, 'utf8');
    const second = JSON.parse(execFileSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
    })) as { reportRevisionId: string; html: string };
    const envelope = publishedAcceptedReportEnvelopeSchema.parse(
      JSON.parse(readFileSync(publicEnvelope, 'utf8')),
    );

    expect(second.reportRevisionId).toBe(first.reportRevisionId);
    expect(envelope.evidenceHead).toEqual({ commit: evidenceCommit, tree: evidenceTree });
    expect(reportGenerationPolicy(true).nextActions).toEqual([]);
    expect(readFileSync(publicEnvelope, 'utf8')).toBe(firstEnvelope);
    expect(readFileSync(join(repoRoot, second.html), 'utf8')).toBe(firstHtml);
    expect(readFileSync(state, 'utf8')).toBe(firstState);
    expect(execFileSync('git', ['status', '--short'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })).toBe(trackedBefore);
  }, 15_000);

  it('rejects a held local state lock and removed bare trust flags', () => {
    const directory = privateTemp('lock-test-');
    const state = join(directory, 'state.json');
    writeFileSync(`${state}.lock`, 'held', 'utf8');
    const locked = spawnSync(process.execPath, [
      cli,
      'generate',
      '--session',
      fixture,
      '--complete',
      '--state',
      state,
      '--public',
      join(directory, 'public.json'),
      '--html-directory',
      join(directory, 'html'),
    ], { cwd: repoRoot, encoding: 'utf8' });
    expect(locked.status).toBe(1);
    expect(locked.stderr).toContain('holds the local state lock');

    const bareTrust = spawnSync(process.execPath, [
      cli,
      'generate',
      '--verified',
    ], { cwd: repoRoot, encoding: 'utf8' });
    expect(bareTrust.status).toBe(1);
    expect(bareTrust.stderr).toContain('Unknown argument: --verified');

    const noExplicitSession = spawnSync(process.execPath, [
      cli,
      'generate',
      '--final',
      '--complete',
    ], { cwd: repoRoot, encoding: 'utf8' });
    expect(noExplicitSession.status).toBe(1);
    expect(noExplicitSession.stderr).toContain('requires an explicit --session');

    const noEvidenceHead = spawnSync(process.execPath, [
      cli,
      'generate',
      '--final',
      '--session',
      fixture,
      '--complete',
    ], { cwd: repoRoot, encoding: 'utf8' });
    expect(noEvidenceHead.status).toBe(1);
    expect(noEvidenceHead.stderr).toContain('requires an explicit --evidence-head');

    const help = execFileSync(process.execPath, [cli, 'help'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(help).toContain('evidence commit');
    expect(help).toContain('publication commit');
  });
});

describe('reporting architecture boundary', () => {
  function TypeScriptFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory()
        ? TypeScriptFiles(path)
        : path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
    });
  }

  it('forces every consumer through index.ts and keeps the core browser-compatible', () => {
    const capabilityRoot = join(repoRoot, 'src/capabilities/work-session-reporting');
    const consumers = [
      ...TypeScriptFiles(join(repoRoot, 'src')),
      ...TypeScriptFiles(join(repoRoot, 'tools')),
    ].filter((path) => !path.startsWith(capabilityRoot));
    const privateImports = consumers.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return /from\s+['"][^'"]*work-session-reporting\/(?:contract|core)(?:\/|\.ts)/.test(source)
        ? [relative(repoRoot, path)]
        : [];
    });
    expect(privateImports).toEqual([]);

    const coreSources = TypeScriptFiles(join(capabilityRoot, 'core'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(coreSources).not.toMatch(/from ['"]node:/);
    expect(coreSources).not.toMatch(/from ['"](?:react|@xyflow|vite)/);
  });
});
