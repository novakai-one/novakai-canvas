import {
  publishedAcceptedReportEnvelopeSchema,
  type PublishedAcceptedReportEnvelope,
} from './contract.ts';
import { stableHash, stableJson } from './core/stable-value.ts';

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

/**
 * Verifies the complete public reporting envelope at an untrusted host seam.
 *
 * This is intentionally synchronous and browser-safe so every host applies the
 * same publication, projection, receipt, count, and completion policy.
 */
export function verifyPublishedProjectionEnvelope(
  input: unknown,
): PublishedAcceptedReportEnvelope {
  const envelope = publishedAcceptedReportEnvelopeSchema.parse(input);
  const { publicationDigest, ...unsigned } = envelope;
  if (digest(unsigned) !== publicationDigest) {
    throw new Error('Published envelope digest does not match its accepted revision.');
  }

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
  if (envelope.publishedAt !== envelope.acceptedAt) {
    throw new Error('Published timestamp disagrees with its accepted revision.');
  }
  if (projection.title !== projection.outcome.headline) {
    throw new Error('Published title disagrees with its report outcome.');
  }
  if (digest(projection) !== envelope.publicProjectionDigest) {
    throw new Error('Public projection digest does not match the redacted projection bytes.');
  }

  const receiptIdSet = new Set(envelope.receiptIds);
  if (receiptIdSet.size !== envelope.receiptIds.length) {
    throw new Error('Published receipt references must be unique.');
  }
  const expectedReceiptsDigest = digest(
    envelope.receiptIds.map((id) => ({ id, sourceDigest: envelope.sourceDigest })),
  );
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
  for (const [index, receiptId] of envelope.receiptIds.entries()) {
    const claim = envelope.receiptClaims[index];
    if (!claim || claim.id !== receiptId || claim.sourceDigest !== envelope.sourceDigest) {
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
      if (receipt.type !== type) {
        throw new Error(`Published ${type} category contains another receipt type.`);
      }
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
        || stableJson(claim.proof) !== stableJson(receipt.proof)
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
    changes: envelope.receiptClaims.filter((claim) => claim.type === 'change').length,
    decisions: envelope.receiptClaims.filter((claim) => claim.type === 'decision').length,
    proofs: envelope.receiptClaims.filter((claim) => claim.type === 'proof').length,
    blockers: envelope.receiptClaims.filter((claim) => claim.type === 'blocker').length,
    artifacts: envelope.receiptClaims.filter((claim) => claim.type === 'artifact').length,
  };
  const changeMapCount = projection.changeMap.nodes
    .reduce((total, node) => total + node.receiptCount, 0);
  if (changeMapCount !== derivedCounts.changes) {
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

  return deepFreeze(envelope);
}
