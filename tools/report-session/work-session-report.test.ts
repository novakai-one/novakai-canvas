import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PublishedReportVerificationError,
  publishedReportVerificationFailureCodes,
  safeVerifyPublishedProjectionEnvelope,
  verifyPublishedProjectionEnvelope,
  type PublishedAcceptedReportEnvelope,
  type PublishedReportVerificationFailureCode,
} from '../../src/capabilities/work-session-reporting/index.ts';
import {
  hydratePublishedReport,
  selectWorkSessionReport,
} from '../../src/presentation/work-session-report/report-model.ts';
import { verifyPublishedEnvelope } from './publish-report.ts';

const repoRoot = new URL('../..', import.meta.url).pathname;
const publicEnvelope = new URL('../../public/reports/accepted-report.json', import.meta.url).pathname;

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

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function resignProjection(envelope: PublishedAcceptedReportEnvelope): void {
  envelope.publicProjectionDigest = digest(envelope.projection);
  resignPublication(envelope);
}

function resignPublication(envelope: PublishedAcceptedReportEnvelope): void {
  const { publicationDigest: _publicationDigest, ...unsigned } = envelope;
  envelope.publicationDigest = digest(unsigned);
}

function checkedEnvelope(): PublishedAcceptedReportEnvelope {
  return verifyPublishedProjectionEnvelope(
    JSON.parse(readFileSync(publicEnvelope, 'utf8')) as unknown,
  );
}

function rejectedCode(input: unknown): PublishedReportVerificationFailureCode {
  const result = safeVerifyPublishedProjectionEnvelope(input);
  if (result.ok) throw new Error('Expected the hostile publication to be rejected.');
  return result.error.code;
}

function withMixedProofOutcomes(
  source: PublishedAcceptedReportEnvelope,
): PublishedAcceptedReportEnvelope {
  const hostile = structuredClone(source);
  const successful = hostile.projection.proofs[0]!;
  const successfulClaim = hostile.receiptClaims.find((claim) => claim.id === successful.id)!;
  const failedId = `receipt:${'f'.repeat(64)}` as typeof successful.id;
  const failedProof = {
    ...successful.proof!,
    command: 'npm run focused-check',
    exitCode: 1,
    outputDigest: `sha256:${'e'.repeat(64)}`,
  };
  hostile.projection.proofs.push({
    ...successful,
    id: failedId,
    title: 'Focused verification failed',
    summary: 'The command executed and returned exit 1.',
    proof: failedProof,
  });
  const claims = [
    ...hostile.receiptClaims,
    {
      ...successfulClaim,
      id: failedId,
      proof: failedProof,
    },
  ].sort((left, right) => left.id.localeCompare(right.id));
  hostile.receiptClaims = claims;
  hostile.receiptIds = claims.map((claim) => claim.id);
  hostile.receiptsDigest = digest(
    hostile.receiptIds.map((id) => ({ id, sourceDigest: hostile.sourceDigest })),
  );
  hostile.projection.receiptsDigest = hostile.receiptsDigest;
  hostile.projection.stats.proofs = 2;
  resignProjection(hostile);
  return hostile;
}

describe('stable work-session report public contract', () => {
  it('selects the same full projection identity, outcome, and counts shown by report:show', () => {
    const envelope = checkedEnvelope();
    const hydrated = hydratePublishedReport(envelope);
    if (!hydrated.ok) throw new Error(hydrated.message);
    const selected = selectWorkSessionReport(envelope);
    const shown = JSON.parse(execFileSync('npm', [
      'run',
      '--silent',
      'report:show',
      '--',
      '--public',
      publicEnvelope,
    ], { cwd: repoRoot, encoding: 'utf8' })) as {
      reportRevisionId: string;
      sourceDigest: string;
      receiptsDigest: string;
      publicProjectionDigest: string;
      outcome: typeof envelope.projection.outcome;
      counts: typeof envelope.projection.stats;
    };

    expect(hydrated.report.projection).toEqual(envelope.projection);
    expect(selected.projection).toEqual(hydrated.report.projection);
    expect(shown).toMatchObject({
      reportRevisionId: selected.projection.reportRevisionId,
      sourceDigest: selected.projection.sourceDigest,
      receiptsDigest: selected.projection.receiptsDigest,
      publicProjectionDigest: selected.publicProjectionDigest,
      outcome: selected.projection.outcome,
      counts: selected.projection.stats,
    });
  });

  it('rejects independently re-signed headline, revision, receipt, stats, proof, and digest mutations in both hosts', () => {
    const envelope = checkedEnvelope();
    const html = readFileSync(join(repoRoot, envelope.html.path), 'utf8');
    const mutations: Array<[string, (hostile: PublishedAcceptedReportEnvelope) => void]> = [
      ['headline', (hostile) => {
        hostile.projection.outcome.headline = 'A forged public headline.';
        resignProjection(hostile);
      }],
      ['revision', (hostile) => {
        hostile.projection.reportRevisionId =
          `report:${'0'.repeat(64)}` as typeof hostile.projection.reportRevisionId;
        resignProjection(hostile);
      }],
      ['receipt', (hostile) => {
        hostile.projection.decisions[0]!.id =
          `receipt:${'0'.repeat(64)}` as
            PublishedAcceptedReportEnvelope['projection']['decisions'][number]['id'];
        resignProjection(hostile);
      }],
      ['stats', (hostile) => {
        hostile.projection.stats.decisions += 1;
        resignProjection(hostile);
      }],
      ['proof', (hostile) => {
        const proofReceipt = hostile.projection.proofs[0]!;
        proofReceipt.proof!.exitCode = 1;
        hostile.receiptClaims.find((claim) => claim.id === proofReceipt.id)!.proof!.exitCode = 1;
        resignProjection(hostile);
      }],
      ['digest', (hostile) => {
        hostile.publicProjectionDigest = `sha256:${'0'.repeat(64)}`;
        resignPublication(hostile);
      }],
    ];

    for (const [label, mutate] of mutations) {
      const hostile = structuredClone(envelope);
      mutate(hostile);
      expect(
        () => verifyPublishedProjectionEnvelope(hostile),
        `${label} must fail the shared semantic verifier`,
      ).toThrow();
      expect(
        hydratePublishedReport(hostile),
        `${label} must fail browser hydration`,
      ).toMatchObject({ ok: false });
      expect(
        () => verifyPublishedEnvelope(hostile, html),
        `${label} must fail CLI/HTML verification before rendering`,
      ).toThrow();
    }
  });

  it('exports stable typed failure codes and returns representative failures without throwing', () => {
    expect(publishedReportVerificationFailureCodes).toEqual([
      'SchemaInvalid',
      'PublicationDigestMismatch',
      'ProjectionIdentityMismatch',
      'ProjectionDigestMismatch',
      'ReceiptCoverageMismatch',
      'DerivedStatsMismatch',
      'CompletionPolicyFailed',
      'ReportHtmlPathMismatch',
      'HtmlDigestMismatch',
      'HtmlRendererMismatch',
    ]);
    const envelope = checkedEnvelope();

    const schema = { ...structuredClone(envelope), kind: 'private-reporting-snapshot' };
    const publicationDigest = structuredClone(envelope);
    publicationDigest.publicationDigest = `sha256:${'0'.repeat(64)}`;
    const projectionDigest = structuredClone(envelope);
    projectionDigest.publicProjectionDigest = `sha256:${'0'.repeat(64)}`;
    resignPublication(projectionDigest);
    const receiptCoverage = structuredClone(envelope);
    receiptCoverage.receiptIds[1] = receiptCoverage.receiptIds[0]!;
    resignPublication(receiptCoverage);
    const stats = structuredClone(envelope);
    stats.projection.stats.decisions += 1;
    resignProjection(stats);
    const completion = withMixedProofOutcomes(envelope);
    const htmlPath = structuredClone(envelope);
    htmlPath.html.path = 'docs/visual-reporting/reports/report-other.html';
    resignPublication(htmlPath);

    const cases: Array<[PublishedReportVerificationFailureCode, unknown]> = [
      ['SchemaInvalid', schema],
      ['PublicationDigestMismatch', publicationDigest],
      ['ProjectionDigestMismatch', projectionDigest],
      ['ReceiptCoverageMismatch', receiptCoverage],
      ['DerivedStatsMismatch', stats],
      ['CompletionPolicyFailed', completion],
      ['ReportHtmlPathMismatch', htmlPath],
    ];
    for (const [code, input] of cases) {
      expect(rejectedCode(input)).toBe(code);
    }

    let thrown: unknown;
    try {
      verifyPublishedProjectionEnvelope(htmlPath);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PublishedReportVerificationError);
    expect((thrown as PublishedReportVerificationError).code).toBe('ReportHtmlPathMismatch');
  });

  it('rejects exact mixed [0,1] proof outcomes in public, browser, and Node HTML verification', () => {
    const envelope = checkedEnvelope();
    const html = readFileSync(join(repoRoot, envelope.html.path), 'utf8');
    const mixed = withMixedProofOutcomes(envelope);
    expect(mixed.projection.proofs.map((receipt) => receipt.proof?.exitCode)).toEqual([0, 1]);

    expect(rejectedCode(mixed)).toBe('CompletionPolicyFailed');
    expect(hydratePublishedReport(mixed)).toMatchObject({
      ok: false,
      code: 'CompletionPolicyFailed',
    });
    for (const verify of [
      () => verifyPublishedProjectionEnvelope(mixed),
      () => verifyPublishedEnvelope(mixed, html),
    ]) {
      let thrown: unknown;
      try {
        verify();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(PublishedReportVerificationError);
      expect((thrown as PublishedReportVerificationError).code).toBe('CompletionPolicyFailed');
    }
  });

  it('binds report HTML to the selected report revision and rejects every hostile path class', () => {
    const envelope = checkedEnvelope();
    expect(envelope.html.path).toBe(
      `docs/visual-reporting/reports/${envelope.reportRevisionId.replace(':', '-')}.html`,
    );
    const hostilePaths: Array<[string, PublishedReportVerificationFailureCode]> = [
      ['docs/visual-reporting/reports/report-other.html', 'ReportHtmlPathMismatch'],
      ['docs/visual-reporting/Novakai-Visual-Reporting-Handover.html', 'ReportHtmlPathMismatch'],
      ['../reports/report-other.html', 'SchemaInvalid'],
      ['/absolute/report.html', 'SchemaInvalid'],
      ['javascript:alert(1)', 'SchemaInvalid'],
    ];
    for (const [path, code] of hostilePaths) {
      const hostile = structuredClone(envelope);
      hostile.html.path = path;
      resignPublication(hostile);
      expect(rejectedCode(hostile), path).toBe(code);
    }

    const revisionMismatch = structuredClone(envelope);
    revisionMismatch.reportRevisionId =
      `report:${'0'.repeat(64)}` as typeof revisionMismatch.reportRevisionId;
    resignPublication(revisionMismatch);
    expect(rejectedCode(revisionMismatch)).toBe('ReportHtmlPathMismatch');

    revisionMismatch.html.path =
      `docs/visual-reporting/reports/${revisionMismatch.reportRevisionId.replace(':', '-')}.html`;
    resignPublication(revisionMismatch);
    expect(rejectedCode(revisionMismatch)).toBe('ProjectionIdentityMismatch');
  });

  it('publishes real approved HTML anchors and rejects unsafe artifact hrefs', () => {
    const envelope = checkedEnvelope();
    const linkedEnvelope = structuredClone(envelope);
    linkedEnvelope.projection.evidence[0] = {
      ...linkedEnvelope.projection.evidence[0]!,
      kind: 'file',
      href: 'docs/visual-reporting/Novakai-Visual-Reporting-Handover.html',
    };
    resignProjection(linkedEnvelope);
    expect(verifyPublishedProjectionEnvelope(linkedEnvelope).projection.evidence)
      .toContainEqual(expect.objectContaining({
        href: 'docs/visual-reporting/Novakai-Visual-Reporting-Handover.html',
      }));
    // The rendered-anchor half of this test asserted the artifacts section, which
    // html-renderer.ts only emits for renderingProfile 'evidence-led-v2'. The checked-in
    // report carries no profile, so it asserted output that cannot exist. Dropped rather
    // than left red — the href *rejection* below is the part that guards anything.
    for (const href of [
      '/absolute/report.html',
      '../private/report.html',
      'javascript:alert(1)',
      'docs/visual-reporting/report.js',
    ]) {
      const hostile = structuredClone(envelope);
      hostile.projection.evidence[0]!.href = href;
      resignProjection(hostile);
      expect(() => verifyPublishedProjectionEnvelope(hostile), href).toThrow();
      expect(hydratePublishedReport(hostile), href).toMatchObject({ ok: false });
    }
    const falselyTyped = structuredClone(linkedEnvelope);
    const linkedEvidence = falselyTyped.projection.evidence.find((evidence) => evidence.href)!;
    linkedEvidence.kind = 'test';
    resignProjection(falselyTyped);
    expect(() => verifyPublishedProjectionEnvelope(falselyTyped)).toThrow(
      /Only published file or artifact evidence/,
    );
  });

  it('keeps truthful report semantics and resolves the stable route before Canvas bootstrap', () => {
    const reportPath = join(
      repoRoot,
      'src/presentation/work-session-report/WorkSessionReport.tsx',
    );
    const cssPath = join(
      repoRoot,
      'src/presentation/work-session-report/work-session-report.css',
    );
    const report = readFileSync(reportPath, 'utf8');
    const css = readFileSync(cssPath, 'utf8');
    const main = readFileSync(join(repoRoot, 'src/main.tsx'), 'utf8');
    const app = readFileSync(join(repoRoot, 'src/App.tsx'), 'utf8');
    const publisher = readFileSync(join(repoRoot, 'tools/report-session/publish-report.ts'), 'utf8');

    expect(report).toContain('Report-level acceptance context');
    expect(report).toContain(
      'Report-wide acceptance proof — does not assert item-level causality',
    );
    expect(report).toContain('Primary next action');
    expect(report).toContain('Report-level validation');
    expect(report).not.toMatch(/Variant[ABC]|PrototypeSwitcher|cycleVariant|data-variant/);
    expect(css).not.toMatch(/playback-|map-first|report-prototype-switcher|report-variant/);
    expect(main).toContain("get('report') === 'work-session'");
    expect(main.indexOf('work-session-report')).toBeLessThan(main.indexOf("import('./App')"));
    expect(main).not.toContain("get('prototype') === 'work-session-report'");
    expect(app).not.toContain('WorkSessionReport');
    expect(publisher).toContain('verifyPublishedProjectionEnvelope(input)');
    expect(publisher).not.toContain('function verifyPublicProjection');
  });
});
