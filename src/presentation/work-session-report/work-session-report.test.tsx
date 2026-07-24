import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import acceptedReport from '../../../public/reports/accepted-report.json';
import { publishedAcceptedReportEnvelopeSchema } from '../../capabilities/work-session-reporting/index.ts';
import { ReportStatePanel } from './WorkSessionReport.tsx';
import {
  hydratePublishedReport,
  projectionIsEmpty,
  selectReceipt,
} from './report-model.ts';

function checkedReport() {
  const result = hydratePublishedReport(acceptedReport);
  if (!result.ok) throw new Error(result.message);
  return result.report;
}

describe('public work-session report hydration', () => {
  it('validates and freezes the checked-in redacted publication', () => {
    const report = checkedReport();
    expect(report.reportRevisionId).toBe(acceptedReport.reportRevisionId);
    expect(report.publicProjectionDigest).toBe(acceptedReport.publicProjectionDigest);
    expect(report.projection.stats).toEqual({
      changes: 3,
      decisions: 2,
      proofs: 1,
      blockers: 0,
      artifacts: 1,
    });
    expect(report.proofState).toMatchObject({
      status: 'captured',
      command: 'npm run check',
      exitCode: 0,
    });
    expect(Object.isFrozen(report.envelope)).toBe(true);
    expect(Object.isFrozen(report.projection.proofs[0])).toBe(true);
  });

  it('rejects invalid input at the public schema seam', () => {
    const invalid = hydratePublishedReport({
      ...acceptedReport,
      kind: 'private-reporting-snapshot',
    });
    expect(invalid).toMatchObject({ ok: false });
    if (!invalid.ok) expect(invalid.message).toContain('kind');
  });

  it('recognises a valid projection with no report content', () => {
    const emptyEnvelope = structuredClone(
      publishedAcceptedReportEnvelopeSchema.parse(acceptedReport),
    );
    emptyEnvelope.projection.changeMap = { nodes: [], edges: [] };
    emptyEnvelope.projection.workflow = [];
    emptyEnvelope.projection.proofs = [];
    emptyEnvelope.projection.decisions = [];
    emptyEnvelope.projection.blockers = [];
    emptyEnvelope.projection.artifacts = [];
    emptyEnvelope.projection.nextActions = [];
    emptyEnvelope.projection.stats = {
      changes: 0,
      decisions: 0,
      proofs: 0,
      blockers: 0,
      artifacts: 0,
    };
    expect(projectionIsEmpty(emptyEnvelope.projection)).toBe(true);
    expect(projectionIsEmpty(checkedReport().projection)).toBe(false);
  });
});

describe('stable report state selection', () => {
  it('selects real receipts with a stable fallback', () => {
    const projection = checkedReport().projection;
    expect(selectReceipt(projection, projection.artifacts[0]?.id)?.type).toBe('artifact');
    expect(selectReceipt(projection, 'missing')?.type).toBe('proof');
  });

  it('renders visible loading, invalid, and empty state guidance', () => {
    const loading = renderToStaticMarkup(<ReportStatePanel state="loading" />);
    const invalid = renderToStaticMarkup(
      <ReportStatePanel message="projection: invalid" retry={() => undefined} state="invalid" />,
    );
    const empty = renderToStaticMarkup(<ReportStatePanel state="empty" />);
    expect(loading).toContain('Loading the public report projection');
    expect(loading).toContain('role="status"');
    expect(invalid).toContain('Retry public report');
    expect(invalid).toContain('projection: invalid');
    expect(invalid).toContain('role="alert"');
    expect(empty).toContain('Generate a report with structured receipts');
    expect(empty).toContain('role="status"');
  });
});
