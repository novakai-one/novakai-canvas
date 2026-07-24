import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createReportingEngine,
  publishedAcceptedReportEnvelopeSchema,
  reportingSnapshotSchema,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { parseCodexSessionFile } from './codex-session-source.ts';
import { renderStandaloneReport } from './html-renderer.ts';
import {
  createPublishedEnvelope,
  createPublishedProjection,
  verifyPublishedEnvelope,
} from './publish-report.ts';

const repoRoot = new URL('../..', import.meta.url).pathname;
const fixture = new URL('./fixtures/codex-session.jsonl', import.meta.url).pathname;
const cli = new URL('./cli.ts', import.meta.url).pathname;
const NOW = '2026-07-25T00:00:00.000Z';

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
  return accepted.value;
}

describe('report session adapters', () => {
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
    const report = prepareAcceptedReport();
    const projection = createPublishedProjection(report);
    const html = renderStandaloneReport(projection);
    const envelope = createPublishedEnvelope(report, {
      path: `docs/visual-reporting/reports/${report.id.replace(':', '-')}.html`,
      content: html,
    });
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
      '$HOME',
      '$CODEX_HOME',
      '"events"',
      '"providerEventId"',
      'poc-reporting-state.json',
      '.jsonl',
    ]) {
      expect(publicBytes, `checked-in publication must redact ${forbidden}`).not.toContain(forbidden);
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
    const html = readFileSync(join(repoRoot, envelope.html.path), 'utf8');
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
      '--report',
      envelope.reportRevisionId,
    ], { cwd: repoRoot, encoding: 'utf8' })) as { reportRevisionId: string };
    expect(shown.reportRevisionId).toBe(envelope.reportRevisionId);
    const staleSelection = spawnSync(process.execPath, [
      cli,
      'show',
      '--public',
      publicEnvelope,
      '--report',
      `report:${'0'.repeat(64)}`,
    ], { cwd: repoRoot, encoding: 'utf8' });
    expect(staleSelection.status).toBe(1);
    expect(staleSelection.stderr).toContain('not available');
  });

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
