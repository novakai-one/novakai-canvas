import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import acceptedReport from '../../../../public/reports/accepted-report.json';
import { publishedAcceptedReportEnvelopeSchema } from '../../../capabilities/work-session-reporting/index.ts';
import { ReportStatePanel } from './WorkSessionReportPrototype.tsx';
import {
  cycleVariant,
  hydratePublishedReport,
  projectionIsEmpty,
  selectChangeNode,
  selectReceipt,
  selectWorkflowStep,
  variantFromSearch,
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

describe('report prototype state selection', () => {
  it('normalises and cycles shareable A/B/C variant state', () => {
    expect(variantFromSearch('?prototype=work-session-report&variant=C')).toBe('C');
    expect(variantFromSearch('?variant=unknown')).toBe('A');
    expect(cycleVariant('A', -1)).toBe('C');
    expect(cycleVariant('C', 1)).toBe('A');
  });

  it('selects real workflow, module, and receipt state with stable fallbacks', () => {
    const projection = checkedReport().projection;
    expect(selectWorkflowStep(projection, 'compile-report')?.label).toBe('Compile visual report');
    expect(selectWorkflowStep(projection, 'missing')?.id).toBe('import-session');
    expect(selectChangeNode(projection, 'reporting.core')?.label).toBe('Reporting core');
    expect(selectChangeNode(projection, 'missing')?.id).toBe('adapter.codex');
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
