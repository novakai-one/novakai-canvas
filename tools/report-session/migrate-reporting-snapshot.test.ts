import { describe, expect, it } from 'vitest';
import { migrateReportingSnapshot } from './migrate-reporting-snapshot.ts';

describe('private reporting snapshot migration', () => {
  it('derives canonical receipt references for legacy draft and accepted owners', () => {
    const legacy = {
      schemaVersion: 1,
      revision: 4,
      sessions: [],
      receipts: [
        {
          id: 'receipt:z',
          sessionId: 'session:one',
          sourceDigest: 'sha256:one',
          type: 'proof',
          evidence: [{ kind: 'test', uri: 'command:test' }],
        },
        {
          id: 'receipt:a',
          sessionId: 'session:one',
          sourceDigest: 'sha256:one',
          type: 'change',
          evidence: [{ kind: 'file', uri: 'repo:changed.ts' }],
        },
        {
          id: 'receipt:other',
          sessionId: 'session:two',
          sourceDigest: 'sha256:two',
          type: 'change',
          evidence: [],
        },
      ],
      drafts: [
        {
          id: 'report:draft',
          sessionId: 'session:one',
          sourceDigest: 'sha256:one',
          projection: {
            stats: { changes: 1, proofs: 1, decisions: 0, blockers: 0, artifacts: 0 },
            evidence: [{ kind: 'file', uri: 'repo:changed.ts' }],
            proofs: [{ id: 'receipt:z' }],
            decisions: [],
            blockers: [],
            artifacts: [],
          },
        },
      ],
      acceptedReports: [
        {
          id: 'report:accepted',
          sessionId: 'session:one',
          sourceDigest: 'sha256:one',
          projection: {
            stats: { changes: 1, proofs: 1, decisions: 0, blockers: 0, artifacts: 0 },
            evidence: [{ kind: 'file', uri: 'repo:changed.ts' }],
            proofs: [{ id: 'receipt:z' }],
            decisions: [],
            blockers: [],
            artifacts: [],
          },
        },
      ],
    };

    const migrated = migrateReportingSnapshot(legacy) as typeof legacy & {
      drafts: Array<{ receiptIds: string[] }>;
      acceptedReports: Array<{ receiptIds: string[] }>;
    };

    expect(migrated.drafts[0].receiptIds).toEqual(['receipt:a', 'receipt:z']);
    expect(migrated.acceptedReports[0].receiptIds).toEqual(['receipt:a', 'receipt:z']);
    expect(legacy.drafts[0]).not.toHaveProperty('receiptIds');
  });

  it('preserves current owners and leaves unknown snapshots for strict validation', () => {
    const current = {
      schemaVersion: 1,
      receipts: [],
      drafts: [{ sessionId: 'session:one', sourceDigest: 'sha256:one', receiptIds: ['receipt:kept'] }],
      acceptedReports: [],
    };
    const malformed = { schemaVersion: 1, receipts: 'not-an-array' };

    expect(migrateReportingSnapshot(current)).toEqual(current);
    expect(migrateReportingSnapshot(malformed)).toBe(malformed);
  });
});
