import { createHash } from 'node:crypto';
import {
  publishedAcceptedReportEnvelopeSchema,
  type AcceptedReport,
  type EvidenceRef,
  type PublishedAcceptedReportEnvelope,
  type PublishedEvidence,
  type PublishedReceipt,
  type PublishedReportProjection,
  type WorkReceipt,
} from '../../src/capabilities/work-session-reporting/index.ts';

function digest(value: string): string {
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

function redactText(value: string): string {
  return value
    .replaceAll(/\/Users\/[^/\s]+(?:\/[^\s<>"']*)?/g, '[redacted-path]')
    .replaceAll(/[A-Za-z]:\\Users\\[^\\\s]+(?:\\[^\s<>"']*)?/g, '[redacted-path]')
    .replaceAll(/\$HOME(?:\/[^\s<>"']*)?/g, '[redacted-path]')
    .replaceAll(/\$CODEX_HOME(?:\/[^\s<>"']*)?/g, '[redacted-path]');
}

function publicEvidence(evidence: EvidenceRef): PublishedEvidence {
  return {
    kind: evidence.kind,
    label: redactText(evidence.label),
  };
}

function publicEvidenceList(evidence: readonly EvidenceRef[]): PublishedEvidence[] {
  return evidence.flatMap((item) => {
    const identity = `${item.label} ${item.uri}`;
    if (
      identity.includes('.jsonl')
      || identity.includes('poc-reporting-state.json')
      || identity.includes('.novakai-reports')
    ) {
      return [];
    }
    return [publicEvidence(item)];
  });
}

function publicReceipt(receipt: WorkReceipt): PublishedReceipt {
  return {
    type: receipt.type,
    title: redactText(receipt.title),
    summary: redactText(receipt.summary),
    evidence: publicEvidenceList(receipt.evidence),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Redacts an accepted projection before it crosses the served publication boundary. */
export function createPublishedProjection(report: AcceptedReport): PublishedReportProjection {
  return {
    schemaVersion: 1,
    reportRevisionId: report.projection.reportRevisionId,
    sourceDigest: report.projection.sourceDigest,
    receiptsDigest: report.projection.receiptsDigest,
    title: redactText(report.projection.title),
    source: structuredClone(report.projection.source),
    outcome: {
      status: report.projection.outcome.status,
      headline: redactText(report.projection.outcome.headline),
      summary: redactText(report.projection.outcome.summary),
    },
    stats: structuredClone(report.projection.stats),
    changeMap: {
      nodes: report.projection.changeMap.nodes.map((node) => ({
        ...node,
        id: redactText(node.id),
        label: redactText(node.label),
      })),
      edges: report.projection.changeMap.edges.map((edge) => ({
        ...edge,
        id: redactText(edge.id),
        source: redactText(edge.source),
        target: redactText(edge.target),
        label: redactText(edge.label),
      })),
    },
    workflow: report.projection.workflow.map((step) => ({
      ...step,
      id: redactText(step.id),
      label: redactText(step.label),
      detail: redactText(step.detail),
    })),
    proofs: report.projection.proofs.map(publicReceipt),
    decisions: report.projection.decisions.map(publicReceipt),
    blockers: report.projection.blockers.map(publicReceipt),
    artifacts: report.projection.artifacts.map(publicReceipt),
    nextActions: report.projection.nextActions.map((action) => ({
      ...action,
      id: redactText(action.id),
      label: redactText(action.label),
      dependsOn: action.dependsOn.map(redactText),
    })),
    evidence: publicEvidenceList(report.projection.evidence),
  };
}

/** Builds the only JSON shape visual hosts may consume; raw session truth is omitted. */
export function createPublishedEnvelope(
  report: AcceptedReport,
  html: { path: string; content: string },
): PublishedAcceptedReportEnvelope {
  const projection = createPublishedProjection(report);
  const unsigned = {
    schemaVersion: 1 as const,
    kind: 'accepted-report-publication' as const,
    publishedAt: report.acceptedAt,
    reportRevisionId: report.id,
    sourceDigest: report.sourceDigest,
    receiptsDigest: report.receiptsDigest,
    projectionDigest: report.projectionDigest,
    acceptedAt: report.acceptedAt,
    html: {
      path: html.path,
      digest: digest(html.content),
    },
    projection,
  };
  return deepFreeze(publishedAcceptedReportEnvelopeSchema.parse({
    ...unsigned,
    publicationDigest: digest(canonical(unsigned)),
  }));
}

/** Runtime-validates the manifest and the immutable HTML bytes it selects. */
export function verifyPublishedEnvelope(
  input: unknown,
  htmlContent: string,
): PublishedAcceptedReportEnvelope {
  const envelope = publishedAcceptedReportEnvelopeSchema.parse(input);
  const { publicationDigest, ...unsigned } = envelope;
  if (digest(canonical(unsigned)) !== publicationDigest) {
    throw new Error('Published envelope digest does not match its accepted revision.');
  }
  if (digest(htmlContent) !== envelope.html.digest) {
    throw new Error('Published HTML digest does not match the selected accepted revision.');
  }
  return deepFreeze(envelope);
}
