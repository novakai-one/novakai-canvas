import {
  publishedAcceptedReportEnvelopeSchema,
  type PublishedAcceptedReportEnvelope,
} from './contract.ts';
import { stableHash, stableJson } from './core/stable-value.ts';

export const publishedReportVerificationFailureCodes = Object.freeze([
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
] as const);

export type PublishedReportVerificationFailureCode =
  (typeof publishedReportVerificationFailureCodes)[number];

export interface PublishedReportVerificationFailure {
  code: PublishedReportVerificationFailureCode;
  message: string;
  issues?: readonly string[];
}

export type PublishedReportVerificationResult =
  | { ok: true; value: PublishedAcceptedReportEnvelope }
  | { ok: false; error: PublishedReportVerificationFailure };

/** Typed assertion failure for hosts that prefer exceptions over a safe result. */
export class PublishedReportVerificationError extends Error {
  readonly code: PublishedReportVerificationFailureCode;
  readonly issues?: readonly string[];

  constructor(failure: PublishedReportVerificationFailure) {
    super(failure.message);
    this.name = 'PublishedReportVerificationError';
    this.code = failure.code;
    this.issues = failure.issues;
  }
}

function digest(value: unknown): string {
  return `sha256:${stableHash(value)}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function failure(
  code: PublishedReportVerificationFailureCode,
  message: string,
  issues?: readonly string[],
): PublishedReportVerificationFailure {
  return { code, message, ...(issues && issues.length > 0 ? { issues } : {}) };
}

function expectedReportHtmlPath(reportRevisionId: string): string {
  return `docs/visual-reporting/reports/${reportRevisionId.replace(':', '-')}.html`;
}

function verifySemantics(
  envelope: PublishedAcceptedReportEnvelope,
): PublishedReportVerificationFailure | undefined {
  const { publicationDigest, ...unsigned } = envelope;
  if (digest(unsigned) !== publicationDigest) {
    return failure(
      'PublicationDigestMismatch',
      'Published envelope digest does not match its accepted revision.',
    );
  }

  const expectedHtmlPath = expectedReportHtmlPath(envelope.reportRevisionId);
  if (envelope.html.path !== expectedHtmlPath) {
    return failure(
      'ReportHtmlPathMismatch',
      `Published HTML path must be exactly ${expectedHtmlPath}.`,
    );
  }

  const projection = envelope.projection;
  if (envelope.reportRevisionId !== projection.reportRevisionId) {
    return failure(
      'ProjectionIdentityMismatch',
      'Published report revision disagrees with its public projection.',
    );
  }
  if (envelope.sourceDigest !== projection.sourceDigest) {
    return failure(
      'ProjectionIdentityMismatch',
      'Published source digest disagrees with its public projection.',
    );
  }
  if (envelope.receiptsDigest !== projection.receiptsDigest) {
    return failure(
      'ProjectionIdentityMismatch',
      'Published receipts digest disagrees with its public projection.',
    );
  }
  if (envelope.publishedAt !== envelope.acceptedAt) {
    return failure(
      'ProjectionIdentityMismatch',
      'Published timestamp disagrees with its accepted revision.',
    );
  }
  if (projection.title !== projection.outcome.headline) {
    return failure(
      'ProjectionIdentityMismatch',
      'Published title disagrees with its report outcome.',
    );
  }
  if (digest(projection) !== envelope.publicProjectionDigest) {
    return failure(
      'ProjectionDigestMismatch',
      'Public projection digest does not match the redacted projection bytes.',
    );
  }

  const receiptIdSet = new Set(envelope.receiptIds);
  if (receiptIdSet.size !== envelope.receiptIds.length) {
    return failure('ReceiptCoverageMismatch', 'Published receipt references must be unique.');
  }
  const expectedReceiptsDigest = digest(
    envelope.receiptIds.map((id) => ({ id, sourceDigest: envelope.sourceDigest })),
  );
  if (expectedReceiptsDigest !== envelope.receiptsDigest) {
    return failure(
      'ReceiptCoverageMismatch',
      'Published receipt references do not match the receipts digest.',
    );
  }
  if (envelope.receiptClaims.length !== envelope.receiptIds.length) {
    return failure(
      'ReceiptCoverageMismatch',
      'Published receipt claims must cover every authoritative receipt reference.',
    );
  }
  const claimsById = new Map(envelope.receiptClaims.map((claim) => [claim.id, claim]));
  if (claimsById.size !== envelope.receiptClaims.length) {
    return failure('ReceiptCoverageMismatch', 'Published receipt claims must be unique.');
  }
  for (const [index, receiptId] of envelope.receiptIds.entries()) {
    const claim = envelope.receiptClaims[index];
    if (!claim || claim.id !== receiptId || claim.sourceDigest !== envelope.sourceDigest) {
      return failure(
        'ReceiptCoverageMismatch',
        'Published receipt claims disagree with authoritative receipt references.',
      );
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
      if (receipt.type !== type) {
        return failure(
          'ReceiptCoverageMismatch',
          `Published ${type} category contains another receipt type.`,
        );
      }
      if (receipt.sourceDigest !== envelope.sourceDigest) {
        return failure(
          'ReceiptCoverageMismatch',
          `Published ${type} receipt belongs to another source.`,
        );
      }
      if (!receiptIdSet.has(receipt.id)) {
        return failure(
          'ReceiptCoverageMismatch',
          `Published ${type} receipt lacks an authoritative receipt reference.`,
        );
      }
      const claim = claimsById.get(receipt.id);
      if (
        !claim
        || claim.type !== type
        || stableJson(claim.proof) !== stableJson(receipt.proof)
      ) {
        return failure(
          'ReceiptCoverageMismatch',
          `Published ${type} receipt copy disagrees with its authoritative claim.`,
        );
      }
      if (publishedIds.has(receipt.id)) {
        return failure('ReceiptCoverageMismatch', 'Published receipt copies must be unique.');
      }
      publishedIds.add(receipt.id);
    }
    if (receipts.length !== envelope.receiptClaims.filter((claim) => claim.type === type).length) {
      return failure(
        'ReceiptCoverageMismatch',
        `Published ${type} copies do not cover their authoritative claims.`,
      );
    }
  }

  const derivedCounts = {
    changes: envelope.receiptClaims.filter((claim) => claim.type === 'change').length,
    decisions: envelope.receiptClaims.filter((claim) => claim.type === 'decision').length,
    proofs: envelope.receiptClaims.filter((claim) => claim.type === 'proof').length,
    blockers: envelope.receiptClaims.filter((claim) => claim.type === 'blocker').length,
    artifacts: envelope.receiptClaims.filter((claim) => claim.type === 'artifact').length,
  };
  const changeMapCount = projection.changeMap.nodes
    .reduce((total, node) => total + node.receiptCount, 0);
  if (changeMapCount !== derivedCounts.changes) {
    return failure(
      'DerivedStatsMismatch',
      'Published change count disagrees with its authoritative change map.',
    );
  }
  for (const [category, count] of Object.entries(derivedCounts)) {
    if (projection.stats[category as keyof typeof projection.stats] !== count) {
      return failure(
        'DerivedStatsMismatch',
        `Published ${category} count disagrees with its derived receipts.`,
      );
    }
  }

  if (projection.outcome.status === 'complete') {
    if (
      !projection.source.complete
      || projection.source.warningCount > 0
      || projection.source.eventCount === 0
    ) {
      return failure(
        'CompletionPolicyFailed',
        'Published completion disagrees with normalized source authority.',
      );
    }
    const proofClaims = envelope.receiptClaims.filter((claim) => claim.type === 'proof');
    if (proofClaims.length === 0) {
      return failure(
        'CompletionPolicyFailed',
        'Published completion lacks a structured command proof.',
      );
    }
    if (proofClaims.some((claim) => claim.proof?.exitCode !== 0)) {
      return failure(
        'CompletionPolicyFailed',
        'Published completion contains a non-successful authoritative command proof.',
      );
    }
    if (projection.blockers.length > 0) {
      return failure(
        'CompletionPolicyFailed',
        'Published completion contains an unresolved blocker.',
      );
    }
    if (projection.nextActions.some((action) => action.status === 'next' || action.status === 'blocked')) {
      return failure(
        'CompletionPolicyFailed',
        'Published completion contains unresolved work.',
      );
    }
  }

  return undefined;
}

/**
 * Safely verifies the complete public reporting envelope at an untrusted host seam.
 *
 * This is intentionally synchronous and browser-safe so every host applies the
 * same publication, projection, receipt, count, and completion policy.
 */
export function safeVerifyPublishedProjectionEnvelope(
  input: unknown,
): PublishedReportVerificationResult {
  const parsed = publishedAcceptedReportEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });
    return {
      ok: false,
      error: failure(
        'SchemaInvalid',
        issues[0] ?? 'The publication does not match the public contract.',
        issues,
      ),
    };
  }
  const semanticFailure = verifySemantics(parsed.data);
  return semanticFailure
    ? { ok: false, error: semanticFailure }
    : { ok: true, value: deepFreeze(parsed.data) };
}

/** Convenience assertion wrapper around the stable, discriminated verifier. */
export function verifyPublishedProjectionEnvelope(
  input: unknown,
): PublishedAcceptedReportEnvelope {
  const result = safeVerifyPublishedProjectionEnvelope(input);
  if (!result.ok) throw new PublishedReportVerificationError(result.error);
  return result.value;
}
