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
      schemaVersion: 2,
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
      changes: [{
        title: 'Make report changes concrete',
        module: {
          id: 'reporting.contract',
          label: 'Reporting contract',
          role: 'interface',
        },
        relatedModules: [],
        files: ['tools/report-session/agent-work-brief.ts'],
        why: 'Readers need to understand the work without the transcript.',
        before: 'The report only listed generic changed areas.',
        after: 'The report names the file, reason, and visible effect.',
        evidence: [],
        tags: ['report'],
      }],
      decisions: [{
        title: 'Separate claims from proof',
        rationale: 'Agents explain the work; repository execution proves it.',
        evidence: [],
        tags: [],
      }],
      problems: [{
        problem: 'Generic summaries hid the implementation story.',
        resolution: 'A before-to-after change claim now carries the story.',
        evidence: [],
        tags: [],
      }],
      artifacts: [{
        title: 'Evidence wall',
        whatYouHaveNow: 'Canvas displays the accepted public report projection.',
        evidence: [{
          kind: 'file',
          label: 'Stable report host',
          uri: 'repo:src/presentation/work-session-report/WorkSessionReport.tsx',
        }],
        tags: ['canvas'],
      }],
      remainingWork: [{
        id: 'validate-usefulness',
        label: 'Use the report on another real session',
        status: 'queued',
        dependsOn: [],
      }],
      renderingProfile: 'evidence-led-v2',
    },
  } as const;
}

describe('agent work brief adapter', () => {
  it('binds the end-session Outcome / Changes / Decisions / Artifacts / Remaining-work claims', () => {
    const { session, value } = validBrief();
    const loaded = loadAgentWorkBrief(writeBrief(value), session);

    expect(loaded.policy).toEqual({
      outcome: value.outcome,
      nextActions: value.remainingWork,
      renderingProfile: 'evidence-led-v2',
    });
    expect(loaded.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sessionId: session.id,
        type: 'change',
        title: 'Make report changes concrete',
        summary: expect.stringContaining('Before — The report only listed generic changed areas.'),
        evidence: expect.arrayContaining([
          expect.objectContaining({
            uri: 'repo:tools/report-session/agent-work-brief.ts',
          }),
        ]),
      }),
      expect.objectContaining({
        type: 'decision',
        title: 'Separate claims from proof',
      }),
      expect.objectContaining({
        type: 'decision',
        title: 'Problem resolved — Generic summaries hid the implementation story.',
        summary: expect.stringContaining('Resolution — A before-to-after change claim'),
        tags: ['agent-authored', 'problem-resolution'],
      }),
      expect.objectContaining({
        type: 'artifact',
        title: 'Evidence wall',
        summary: 'You now have — Canvas displays the accepted public report projection.',
        tags: ['agent-authored', 'canvas'],
      }),
    ]));
    expect(loaded.receipts.every((receipt) => !('proof' in receipt))).toBe(true);
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

    const selfProof = structuredClone(value) as unknown as {
      changes: Array<Record<string, unknown>>;
    };
    selfProof.changes[0]!.proof = {
      command: 'true',
      exitCode: 0,
    };
    expect(() => loadAgentWorkBrief(writeBrief(selfProof), session)).toThrow();
  });

  it('carries a validated brief through CLI generation into both public hosts', () => {
    const { value } = validBrief();
    const briefPath = writeBrief({
      ...value,
      outcome: { ...value.outcome, status: 'partial' },
      remainingWork: [],
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
    expect(envelope.projection.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Evidence wall' }),
      expect.objectContaining({ title: expect.stringContaining('Repository evidence snapshot') }),
    ]));
    expect(envelope.projection.stats.changes).toBeGreaterThan(0);
    expect(envelope.projection.changeDetails).toEqual([
      expect.objectContaining({
        title: 'Make report changes concrete',
        changeNarrative: {
          before: 'The report only listed generic changed areas.',
          after: 'The report names the file, reason, and visible effect.',
          why: 'Readers need to understand the work without the transcript.',
        },
      }),
    ]);
    expect(envelope.projection.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Problem resolved — Generic summaries hid the implementation story.' }),
    ]));
    expect(html).toContain('What did you get?');
    expect(html).toContain('What changed — before → after?');
    expect(html).toContain('The report names the file, reason, and visible effect.');
    expect(html).toContain('Evidence wall');
  }, 15_000);
});
