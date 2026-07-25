import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createReportingEngine,
  publishedAcceptedReportEnvelopeSchema,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { loadAgentWorkBrief } from './agent-work-brief.ts';
import { parseCodexSessionFile } from './codex-session-source.ts';
import { verifyPublishedEnvelope } from './publish-report.ts';

const repoRoot = new URL('../..', import.meta.url).pathname;
const fixture = new URL('./fixtures/codex-session.jsonl', import.meta.url).pathname;
const cli = new URL('./cli.ts', import.meta.url).pathname;

function importedSession() {
  const engine = createReportingEngine();
  const imported = engine.importSession(parseCodexSessionFile(fixture, { confirmComplete: true }));
  if (!imported.ok) throw new Error(imported.error.message);
  return imported.value;
}

function writeBrief(value: unknown): string {
  const root = join(repoRoot, '.novakai-reports');
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, 'agent-brief-test-'));
  const path = join(directory, 'brief.json');
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
}

function validBrief() {
  const session = importedSession();
  return {
    session,
    value: {
      schemaVersion: 1,
      source: {
        provider: session.provider,
        nativeSessionId: session.nativeSessionId,
        expectedSourceDigest: session.sourceDigest,
      },
      outcome: {
        status: 'complete',
        headline: 'The work is visible.',
        summary: 'One source-bound brief explains what changed and why.',
      },
      nextActions: [{
        id: 'validate-usefulness',
        label: 'Use the report on another real session',
        status: 'queued',
        dependsOn: [],
      }],
      renderingProfile: 'evidence-led-v2',
      receipts: [{
        type: 'artifact',
        title: 'Evidence wall',
        summary: 'Canvas displays the accepted public report projection.',
        evidence: [{
          kind: 'file',
          label: 'Stable report host',
          uri: 'repo:src/presentation/work-session-report/WorkSessionReport.tsx',
        }],
        tags: ['canvas'],
      }],
    },
  } as const;
}

describe('agent work brief adapter', () => {
  it('binds validated non-proof claims to the imported session and policy', () => {
    const { session, value } = validBrief();
    const loaded = loadAgentWorkBrief(writeBrief(value), session);

    expect(loaded.policy).toEqual({
      outcome: value.outcome,
      nextActions: value.nextActions,
      renderingProfile: 'evidence-led-v2',
    });
    expect(loaded.receipts).toEqual([
      expect.objectContaining({
        sessionId: session.id,
        type: 'artifact',
        title: 'Evidence wall',
        tags: ['agent-authored', 'canvas'],
      }),
    ]);
    expect(loaded.receipts[0]).not.toHaveProperty('proof');
  });

  it('rejects stale identity/digest bindings and any attempt to author proof', () => {
    const { session, value } = validBrief();
    const wrongSession = {
      ...structuredClone(value),
      source: { ...value.source, nativeSessionId: 'another-session' },
    };
    expect(() => loadAgentWorkBrief(writeBrief(wrongSession), session))
      .toThrow(/AgentBriefSourceMismatch/);

    const stale = {
      ...structuredClone(value),
      source: { ...value.source, expectedSourceDigest: `sha256:${'0'.repeat(64)}` },
    };
    expect(() => loadAgentWorkBrief(writeBrief(stale), session))
      .toThrow(/expected source digest/);

    const selfProof = structuredClone(value) as Record<string, unknown>;
    selfProof.receipts = [{
      type: 'proof',
      title: 'Trust me',
      summary: 'The agent claims its own proof.',
      evidence: [],
      proof: {
        command: 'true',
        exitCode: 0,
      },
    }];
    expect(() => loadAgentWorkBrief(writeBrief(selfProof), session)).toThrow();
  });

  it('carries a validated brief through CLI generation into both public hosts', () => {
    const { value } = validBrief();
    const briefPath = writeBrief({
      ...value,
      outcome: { ...value.outcome, status: 'partial' },
      nextActions: [],
    });
    const directory = mkdtempSync(join(repoRoot, '.novakai-reports/agent-brief-cli-'));
    const state = join(directory, 'state.json');
    const publicEnvelope = join(directory, 'accepted-report.json');
    const htmlDirectory = join(directory, 'html');
    const evidenceHead = execFileSync('git', ['rev-parse', 'HEAD^{commit}'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();

    execFileSync(process.execPath, [
      cli,
      'generate',
      '--session',
      fixture,
      '--complete',
      '--brief',
      briefPath,
      '--evidence-head',
      evidenceHead,
      '--state',
      state,
      '--public',
      publicEnvelope,
      '--html-directory',
      htmlDirectory,
    ], { cwd: repoRoot, encoding: 'utf8' });

    const envelope = publishedAcceptedReportEnvelopeSchema.parse(
      JSON.parse(readFileSync(publicEnvelope, 'utf8')) as unknown,
    );
    const html = readFileSync(join(htmlDirectory, basename(envelope.html.path)), 'utf8');

    expect(verifyPublishedEnvelope(envelope, html)).toEqual(envelope);
    expect(envelope.projection.renderingProfile).toBe('evidence-led-v2');
    expect(envelope.projection.outcome.headline).toBe('The work is visible.');
    expect(envelope.projection.artifacts).toEqual([
      expect.objectContaining({ title: 'Evidence wall' }),
    ]);
    expect(html).toContain('What did you get?');
    expect(html).toContain('Evidence wall');
  }, 15_000);
});
