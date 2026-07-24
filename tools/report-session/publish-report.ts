import { createHash } from 'node:crypto';
import {
  acceptedReportSchema,
  publishedAcceptedReportEnvelopeSchema,
  workReceiptSchema,
  type AcceptedReport,
  type EvidenceRef,
  type PublishedAcceptedReportEnvelope,
  type PublishedEvidence,
  type PublishedEvidenceHead,
  type PublishedReceipt,
  type PublishedReportProjection,
  type WorkReceipt,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { renderStandaloneReport } from './html-renderer.ts';

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
    .replaceAll(/\/home\/[^/\s]+(?:\/[^\s<>"']*)?/g, '[redacted-path]')
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
    id: receipt.id,
    sourceDigest: receipt.sourceDigest,
    type: receipt.type,
    title: redactText(receipt.title),
    summary: redactText(receipt.summary),
    evidence: publicEvidenceList(receipt.evidence),
    ...(receipt.proof
      ? {
          proof: {
            command: redactText(receipt.proof.command),
            exitCode: receipt.proof.exitCode,
            executedAt: receipt.proof.executedAt,
            outputDigest: receipt.proof.outputDigest,
          },
        }
      : {}),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function authoritativeReceiptsFor(
  reportInput: AcceptedReport,
  receiptInputs: readonly WorkReceipt[],
): { report: AcceptedReport; receipts: WorkReceipt[] } {
  const report = acceptedReportSchema.parse(structuredClone(reportInput));
  const receipts = workReceiptSchema.array().parse(structuredClone(receiptInputs));
  const byId = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  if (byId.size !== receipts.length) throw new Error('Authoritative publication receipts must be unique.');
  const selected = report.receiptIds.map((id) => {
    const receipt = byId.get(id);
    if (!receipt) throw new Error(`Accepted report references missing authoritative receipt ${id}.`);
    if (receipt.sessionId !== report.sessionId || receipt.sourceDigest !== report.sourceDigest) {
      throw new Error(`Accepted report receipt ${id} belongs to another session or source.`);
    }
    return receipt;
  });
  const expectedReceiptsDigest = digest(canonical(
    selected.map((receipt) => ({ id: receipt.id, sourceDigest: receipt.sourceDigest })),
  ));
  if (expectedReceiptsDigest !== report.receiptsDigest) {
    throw new Error('Accepted report receipts digest disagrees with authoritative receipts.');
  }
  const categories = [
    ['proof', report.projection.proofs],
    ['decision', report.projection.decisions],
    ['blocker', report.projection.blockers],
    ['artifact', report.projection.artifacts],
  ] as const;
  for (const [type, copies] of categories) {
    const authoritative = selected.filter((receipt) => receipt.type === type);
    if (canonical(copies) !== canonical(authoritative)) {
      throw new Error(`Accepted report ${type} copies disagree with authoritative receipts.`);
    }
  }
  if (
    report.projection.outcome.status === 'complete'
    && !selected.some((receipt) => receipt.type === 'proof' && receipt.proof?.exitCode === 0)
  ) {
    throw new Error('Accepted completion lacks a successful authoritative command proof.');
  }
  return { report, receipts: selected };
}

/** Redacts an accepted projection before it crosses the served publication boundary. */
export function createPublishedProjection(
  reportInput: AcceptedReport,
  receiptInputs: readonly WorkReceipt[],
): PublishedReportProjection {
  const { report } = authoritativeReceiptsFor(reportInput, receiptInputs);
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
  reportInput: AcceptedReport,
  receiptInputs: readonly WorkReceipt[],
  html: { path: string; content: string },
  evidenceHead: PublishedEvidenceHead,
): PublishedAcceptedReportEnvelope {
  const { report, receipts } = authoritativeReceiptsFor(reportInput, receiptInputs);
  const projection = createPublishedProjection(report, receipts);
  const deterministicHtml = renderStandaloneReport(projection);
  if (html.content !== deterministicHtml) {
    throw new Error('Published HTML must be the deterministic renderer output for its public projection.');
  }
  const receiptClaims = receipts.map((receipt) => ({
    id: receipt.id,
    sourceDigest: receipt.sourceDigest,
    type: receipt.type,
    ...(receipt.proof
      ? {
          proof: {
            command: redactText(receipt.proof.command),
            exitCode: receipt.proof.exitCode,
            executedAt: receipt.proof.executedAt,
            outputDigest: receipt.proof.outputDigest,
          },
        }
      : {}),
  }));
  const unsigned = {
    schemaVersion: 1 as const,
    kind: 'accepted-report-publication' as const,
    publishedAt: report.acceptedAt,
    reportRevisionId: report.id,
    sourceDigest: report.sourceDigest,
    receiptIds: report.receiptIds,
    receiptClaims,
    receiptsDigest: report.receiptsDigest,
    authoritativeProjectionDigest: report.projectionDigest,
    publicProjectionDigest: digest(canonical(projection)),
    acceptedAt: report.acceptedAt,
    evidenceHead: structuredClone(evidenceHead),
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

function verifyPublicProjection(envelope: PublishedAcceptedReportEnvelope): void {
  const projection = envelope.projection;
  if (envelope.reportRevisionId !== projection.reportRevisionId) {
    throw new Error('Published report revision disagrees with its public projection.');
  }
  if (envelope.sourceDigest !== projection.sourceDigest) {
    throw new Error('Published source digest disagrees with its public projection.');
  }
  if (envelope.receiptsDigest !== projection.receiptsDigest) {
    throw new Error('Published receipts digest disagrees with its public projection.');
  }
  if (digest(canonical(projection)) !== envelope.publicProjectionDigest) {
    throw new Error('Public projection digest does not match the redacted projection bytes.');
  }

  const receiptIdSet = new Set(envelope.receiptIds);
  if (receiptIdSet.size !== envelope.receiptIds.length) {
    throw new Error('Published receipt references must be unique.');
  }
  const expectedReceiptsDigest = digest(canonical(
    envelope.receiptIds.map((id) => ({ id, sourceDigest: envelope.sourceDigest })),
  ));
  if (expectedReceiptsDigest !== envelope.receiptsDigest) {
    throw new Error('Published receipt references do not match the receipts digest.');
  }
  if (envelope.receiptClaims.length !== envelope.receiptIds.length) {
    throw new Error('Published receipt claims must cover every authoritative receipt reference.');
  }
  const claimsById = new Map(envelope.receiptClaims.map((claim) => [claim.id, claim]));
  if (claimsById.size !== envelope.receiptClaims.length) {
    throw new Error('Published receipt claims must be unique.');
  }
  for (const [index, receiptIdValue] of envelope.receiptIds.entries()) {
    const claim = envelope.receiptClaims[index];
    if (!claim || claim.id !== receiptIdValue || claim.sourceDigest !== envelope.sourceDigest) {
      throw new Error('Published receipt claims disagree with authoritative receipt references.');
    }
  }

  const categories = [
    ['proof', projection.proofs],
    ['decision', projection.decisions],
    ['blocker', projection.blockers],
    ['artifact', projection.artifacts],
  ] as const;
  const publishedIds = new Set<string>();
  for (const [type, receipts] of categories) {
    for (const receipt of receipts) {
      if (receipt.type !== type) throw new Error(`Published ${type} category contains another receipt type.`);
      if (receipt.sourceDigest !== envelope.sourceDigest) {
        throw new Error(`Published ${type} receipt belongs to another source.`);
      }
      if (!receiptIdSet.has(receipt.id)) {
        throw new Error(`Published ${type} receipt lacks an authoritative receipt reference.`);
      }
      const claim = claimsById.get(receipt.id);
      if (
        !claim
        || claim.type !== type
        || canonical(claim.proof) !== canonical(receipt.proof)
      ) {
        throw new Error(`Published ${type} receipt copy disagrees with its authoritative claim.`);
      }
      if (publishedIds.has(receipt.id)) {
        throw new Error('Published receipt copies must be unique.');
      }
      publishedIds.add(receipt.id);
    }
    if (receipts.length !== envelope.receiptClaims.filter((claim) => claim.type === type).length) {
      throw new Error(`Published ${type} copies do not cover their authoritative claims.`);
    }
  }
  const derivedCounts = {
    decisions: envelope.receiptClaims.filter((claim) => claim.type === 'decision').length,
    proofs: envelope.receiptClaims.filter((claim) => claim.type === 'proof').length,
    blockers: envelope.receiptClaims.filter((claim) => claim.type === 'blocker').length,
    artifacts: envelope.receiptClaims.filter((claim) => claim.type === 'artifact').length,
    changes: envelope.receiptClaims.filter((claim) => claim.type === 'change').length,
  };
  const changeMapCount = projection.changeMap.nodes
    .reduce((total, node) => total + node.receiptCount, 0);
  if (derivedCounts.changes < 0 || changeMapCount !== derivedCounts.changes) {
    throw new Error('Published change count disagrees with its authoritative change map.');
  }
  for (const [category, count] of Object.entries(derivedCounts)) {
    if (projection.stats[category as keyof typeof projection.stats] !== count) {
      throw new Error(`Published ${category} count disagrees with its derived receipts.`);
    }
  }
  if (projection.outcome.status === 'complete') {
    if (!projection.source.complete || projection.source.warningCount > 0 || projection.source.eventCount === 0) {
      throw new Error('Published completion disagrees with normalized source authority.');
    }
    if (!projection.proofs.some((receipt) => receipt.proof?.exitCode === 0)) {
      throw new Error('Published completion lacks a successful structured command proof.');
    }
    if (projection.blockers.length > 0) {
      throw new Error('Published completion contains an unresolved blocker.');
    }
    if (projection.nextActions.some((action) => action.status === 'next' || action.status === 'blocked')) {
      throw new Error('Published completion contains unresolved work.');
    }
  }
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
  verifyPublicProjection(envelope);
  if (digest(htmlContent) !== envelope.html.digest) {
    throw new Error('Published HTML digest does not match the selected accepted revision.');
  }
  if (htmlContent !== renderStandaloneReport(envelope.projection)) {
    throw new Error('Published HTML is not the deterministic renderer output for its public projection.');
  }
  return deepFreeze(envelope);
}
