interface RecordShape {
  [key: string]: unknown;
}

interface ReceiptIdentity {
  id: string;
  sessionId: string;
  sourceDigest: string;
  type: string;
  evidenceKeys: string[];
}

function recordShape(value: unknown): RecordShape | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordShape
    : null;
}

function receiptIdentity(value: unknown): ReceiptIdentity | null {
  const record = recordShape(value);
  const evidence = Array.isArray(record?.evidence) ? record.evidence : null;
  if (
    !record
    || typeof record.id !== 'string'
    || typeof record.sessionId !== 'string'
    || typeof record.sourceDigest !== 'string'
    || typeof record.type !== 'string'
    || !evidence
  ) {
    return null;
  }
  const evidenceKeys = evidence.map((item) => {
    const entry = recordShape(item);
    return entry && typeof entry.kind === 'string' && typeof entry.uri === 'string'
      ? `${entry.kind}|${entry.uri}`
      : null;
  });
  if (evidenceKeys.some((key) => key === null)) return null;
  return {
    id: record.id,
    sessionId: record.sessionId,
    sourceDigest: record.sourceDigest,
    type: record.type,
    evidenceKeys: evidenceKeys as string[],
  };
}

function ownerReceiptIds(
  owner: RecordShape,
  receipts: readonly ReceiptIdentity[],
): string[] | null {
  const projection = recordShape(owner.projection);
  const stats = recordShape(projection?.stats);
  if (
    !projection
    || !stats
    || !Array.isArray(projection.evidence)
    || !['changes', 'proofs', 'decisions', 'blockers', 'artifacts']
      .every((key) => typeof stats[key] === 'number')
  ) {
    return null;
  }
  const evidenceKeys = projection.evidence.map((item) => {
    const evidence = recordShape(item);
    return evidence && typeof evidence.kind === 'string' && typeof evidence.uri === 'string'
      ? `${evidence.kind}|${evidence.uri}`
      : null;
  });
  if (evidenceKeys.some((key) => key === null)) return null;
  const publishedEvidence = new Set(evidenceKeys as string[]);

  const embeddedIds: string[] = [];
  for (const key of ['proofs', 'decisions', 'blockers', 'artifacts']) {
    const entries = projection[key];
    if (!Array.isArray(entries)) return null;
    for (const entry of entries) {
      const receipt = recordShape(entry);
      if (!receipt || typeof receipt.id !== 'string') return null;
      embeddedIds.push(receipt.id);
    }
  }
  const changeIds = receipts
    .filter((receipt) =>
      receipt.sessionId === owner.sessionId
      && receipt.sourceDigest === owner.sourceDigest
      && receipt.type === 'change'
      && receipt.evidenceKeys.every((key) => publishedEvidence.has(key)))
    .map((receipt) => receipt.id);
  if (changeIds.length !== stats.changes) return null;

  const ids = [...embeddedIds, ...changeIds]
    .sort((left, right) => left.localeCompare(right));
  const expectedCount = (stats.changes as number)
    + (stats.proofs as number)
    + (stats.decisions as number)
    + (stats.blockers as number)
    + (stats.artifacts as number);
  return ids.length === expectedCount && new Set(ids).size === ids.length ? ids : null;
}

/**
 * Losslessly upgrades private schema-v1 snapshots written before report owners
 * stored their canonical authoritative receipt references.
 *
 * Unknown shapes are returned untouched so the strict runtime schema remains
 * the final authority instead of this migration silently accepting bad state.
 */
export function migrateReportingSnapshot(input: unknown): unknown {
  const snapshot = recordShape(input);
  if (
    !snapshot
    || snapshot.schemaVersion !== 1
    || !Array.isArray(snapshot.receipts)
    || !Array.isArray(snapshot.drafts)
    || !Array.isArray(snapshot.acceptedReports)
  ) {
    return input;
  }

  const receipts = snapshot.receipts
    .map(receiptIdentity)
    .filter((receipt): receipt is ReceiptIdentity => receipt !== null);
  if (receipts.length !== snapshot.receipts.length) return input;

  const migrateOwner = (value: unknown): unknown => {
    const owner = recordShape(value);
    if (
      !owner
      || owner.receiptIds !== undefined
      || typeof owner.sessionId !== 'string'
      || typeof owner.sourceDigest !== 'string'
    ) {
      return value;
    }
    const receiptIds = ownerReceiptIds(owner, receipts);
    if (!receiptIds) return value;
    return { ...owner, receiptIds };
  };

  return {
    ...snapshot,
    drafts: snapshot.drafts.map(migrateOwner),
    acceptedReports: snapshot.acceptedReports.map(migrateOwner),
  };
}
