import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publishedAcceptedReportEnvelopeSchema } from '../../src/capabilities/work-session-reporting/index.ts';
import { selectPrototypeReport } from '../../src/presentation/prototypes/work-session-report/report-model.ts';

const repoRoot = new URL('../..', import.meta.url).pathname;
const publicEnvelope = new URL('../../public/reports/accepted-report.json', import.meta.url).pathname;

describe('embedded report public contract', () => {
  it('selects the same checked-in revision and counts shown by report:show', () => {
    const envelope = publishedAcceptedReportEnvelopeSchema.parse(
      JSON.parse(readFileSync(publicEnvelope, 'utf8')) as unknown,
    );
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
      stats: {
        changes: number;
        decisions: number;
        proofs: number;
        blockers: number;
        artifacts: number;
      };
    };

    expect(selected.reportRevisionId).toBe(shown.reportRevisionId);
    expect(selected.projection.stats).toEqual(shown.stats);
  });
});
