import {
  verifyPublishedProjectionEnvelope,
  type PublishedAcceptedReportEnvelope,
  type PublishedReceipt,
  type PublishedReportProjection,
} from '../../../capabilities/work-session-reporting/index.ts';

export const REPORT_VARIANTS = ['A', 'B', 'C'] as const;
export type ReportVariant = (typeof REPORT_VARIANTS)[number];

export interface CapturedProofState {
  status: 'captured' | 'failed' | 'missing';
  label: string;
  command?: string;
  executedAt?: string;
  exitCode?: number;
  outputDigest?: string;
}

export interface PrototypeReport {
  envelope: PublishedAcceptedReportEnvelope;
  projection: PublishedReportProjection;
  reportRevisionId: string;
  publicProjectionDigest: string;
  proofState: CapturedProofState;
}

export type ReportHydrationResult =
  | { ok: true; report: PrototypeReport }
  | { ok: false; message: string };

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function proofState(projection: PublishedReportProjection): CapturedProofState {
  const receipt = projection.proofs.find((candidate) => candidate.proof !== undefined);
  if (!receipt?.proof) {
    return {
      status: 'missing',
      label: 'No executed proof is captured in this public projection.',
    };
  }
  return {
    status: receipt.proof.exitCode === 0 ? 'captured' : 'failed',
    label: receipt.title,
    command: receipt.proof.command,
    executedAt: receipt.proof.executedAt,
    exitCode: receipt.proof.exitCode,
    outputDigest: receipt.proof.outputDigest,
  };
}

/** Selects the immutable, public-only model shared by all prototype renderers. */
export function selectPrototypeReport(
  envelope: PublishedAcceptedReportEnvelope,
): PrototypeReport {
  const frozenEnvelope = deepFreeze(envelope);
  return Object.freeze({
    envelope: frozenEnvelope,
    projection: frozenEnvelope.projection,
    reportRevisionId: frozenEnvelope.reportRevisionId,
    publicProjectionDigest: frozenEnvelope.publicProjectionDigest,
    proofState: Object.freeze(proofState(frozenEnvelope.projection)),
  });
}

/** Runtime-validates untrusted HTTP JSON at the public reporting seam. */
export function hydratePublishedReport(input: unknown): ReportHydrationResult {
  try {
    const envelope = verifyPublishedProjectionEnvelope(input);
    return { ok: true, report: selectPrototypeReport(envelope) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error
        ? error.message
        : 'The publication does not match the public contract.',
    };
  }
}

export function variantFromSearch(search: string): ReportVariant {
  const value = new URLSearchParams(search).get('variant');
  return value === 'B' || value === 'C' ? value : 'A';
}

export function cycleVariant(current: ReportVariant, amount: -1 | 1): ReportVariant {
  const index = REPORT_VARIANTS.indexOf(current);
  return REPORT_VARIANTS[
    (index + amount + REPORT_VARIANTS.length) % REPORT_VARIANTS.length
  ];
}

export function projectionIsEmpty(projection: PublishedReportProjection): boolean {
  const receiptCount = projection.proofs.length
    + projection.decisions.length
    + projection.blockers.length
    + projection.artifacts.length;
  const statCount = Object.values(projection.stats).reduce((total, count) => total + count, 0);
  return projection.changeMap.nodes.length === 0
    && projection.changeMap.edges.length === 0
    && projection.workflow.length === 0
    && projection.nextActions.length === 0
    && receiptCount === 0
    && statCount === 0;
}

export function selectWorkflowStep(
  projection: PublishedReportProjection,
  requestedId?: string,
): PublishedReportProjection['workflow'][number] | null {
  return projection.workflow.find((step) => step.id === requestedId)
    ?? projection.workflow[0]
    ?? null;
}

export function selectChangeNode(
  projection: PublishedReportProjection,
  requestedId?: string,
): PublishedReportProjection['changeMap']['nodes'][number] | null {
  return projection.changeMap.nodes.find((node) => node.id === requestedId)
    ?? projection.changeMap.nodes[0]
    ?? null;
}

export function reportReceipts(projection: PublishedReportProjection): PublishedReceipt[] {
  return [
    ...projection.proofs,
    ...projection.artifacts,
    ...projection.decisions,
    ...projection.blockers,
  ];
}

export function selectReceipt(
  projection: PublishedReportProjection,
  requestedId?: string,
): PublishedReceipt | null {
  const receipts = reportReceipts(projection);
  return receipts.find((receipt) => receipt.id === requestedId) ?? receipts[0] ?? null;
}
