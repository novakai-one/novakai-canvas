import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  verifyPublishedProjectionEnvelope,
  type PublishedAcceptedReportEnvelope,
} from '../../src/capabilities/work-session-reporting/index.ts';
import {
  hydratePublishedReport,
  selectPrototypeReport,
} from '../../src/presentation/prototypes/work-session-report/report-model.ts';
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

describe('embedded report public contract', () => {
  it('selects the same full projection identity, outcome, and counts shown by report:show', () => {
    const envelope = checkedEnvelope();
    const hydrated = hydratePublishedReport(envelope);
    if (!hydrated.ok) throw new Error(hydrated.message);
    const selected = selectPrototypeReport(envelope);
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

  it('publishes real approved HTML anchors and rejects unsafe artifact hrefs', () => {
    const envelope = checkedEnvelope();
    const html = readFileSync(join(repoRoot, envelope.html.path), 'utf8');
    expect(envelope.projection.evidence).toContainEqual(expect.objectContaining({
      label: 'Open visual handover',
      href: 'docs/visual-reporting/Novakai-Visual-Reporting-Handover.html',
    }));
    expect(html).toContain(
      '<a href="../../../docs/visual-reporting/Novakai-Visual-Reporting-Handover.html">',
    );

    for (const href of [
      '/absolute/report.html',
      '../private/report.html',
      'javascript:alert(1)',
      'docs/visual-reporting/report.js',
    ]) {
      const hostile = structuredClone(envelope);
      hostile.projection.evidence[0]!.href = href;
      expect(() => verifyPublishedProjectionEnvelope(hostile), href).toThrow();
      expect(hydratePublishedReport(hostile), href).toMatchObject({ ok: false });
    }
    const falselyTyped = structuredClone(envelope);
    const linkedEvidence = falselyTyped.projection.evidence.find((evidence) => evidence.href)!;
    linkedEvidence.kind = 'test';
    resignProjection(falselyTyped);
    expect(() => verifyPublishedProjectionEnvelope(falselyTyped)).toThrow(
      /Only published file or artifact evidence/,
    );
  });

  it('keeps truthful report-level semantics, responsive content, and early dev isolation in source', () => {
    const prototypePath = join(
      repoRoot,
      'src/presentation/prototypes/work-session-report/WorkSessionReportPrototype.tsx',
    );
    const cssPath = join(
      repoRoot,
      'src/presentation/prototypes/work-session-report/work-session-report-prototype.css',
    );
    const prototype = readFileSync(prototypePath, 'utf8');
    const css = readFileSync(cssPath, 'utf8');
    const main = readFileSync(join(repoRoot, 'src/main.tsx'), 'utf8');
    const app = readFileSync(join(repoRoot, 'src/App.tsx'), 'utf8');
    const publisher = readFileSync(join(repoRoot, 'tools/report-session/publish-report.ts'), 'utf8');

    expect(prototype).toContain('Report-level acceptance context');
    expect(prototype).toContain(
      'Report-wide acceptance proof — does not assert item-level causality',
    );
    expect(prototype).toContain('Primary next action');
    expect(prototype).toContain('Report-level validation');
    expect(prototype).toContain('role="group"');
    expect(prototype).not.toContain('selectNode={() => undefined}');
    expect(css).not.toMatch(/\.playback-proof-dock\s*\{\s*display:\s*none/);
    expect(css).not.toMatch(/\.playback-module-index\s*\{\s*display:\s*none/);
    expect(css).not.toMatch(/pointer-events:\s*none/);

    expect(main.indexOf('work-session-report')).toBeLessThan(main.indexOf("import('./App')"));
    expect(app).not.toContain('WorkSessionReportPrototype');
    expect(publisher).toContain('verifyPublishedProjectionEnvelope(input)');
    expect(publisher).not.toContain('function verifyPublicProjection');
  });
});
