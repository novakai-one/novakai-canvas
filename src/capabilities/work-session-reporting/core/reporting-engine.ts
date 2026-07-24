import {
  acceptReportInputSchema,
  compileReportInputSchema,
  importSessionInputSchema,
  recordReceiptInputSchema,
  reportingSnapshotSchema,
  type AcceptedReport,
  type ReportDraft,
  type ReportRevisionId,
  type ReportingFailure,
  type ReportingResult,
  type ReportingSnapshot,
  type ReceiptId,
  type WorkReceipt,
  type WorkSession,
  type WorkSessionId,
  type WorkSessionReporting,
} from '../contract.ts';
import { compileProjection } from './report-compiler.ts';
import { stableHash } from './stable-value.ts';

interface ReportingOptions {
  initialSnapshot?: unknown;
  now?: () => string;
}

function failure(
  code: ReportingFailure['code'],
  message: string,
  detail: Partial<ReportingFailure> = {},
): ReportingResult<never> {
  return { ok: false, error: { code, message, ...detail } };
}

function validationFailure(issues: string[]): ReportingResult<never> {
  return failure('ValidationFailed', 'Input failed runtime validation.', { issues });
}

function issues(result: { error: { issues: readonly { path: PropertyKey[]; message: string }[] } }): string[] {
  return result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
}

function sessionId(provider: string, nativeSessionId: string): WorkSessionId {
  return `session:${stableHash([provider, nativeSessionId])}` as WorkSessionId;
}

function receiptId(input: {
  sessionId: WorkSessionId;
  type: string;
  title: string;
  summary: string;
  evidence: unknown;
}): ReceiptId {
  return `receipt:${stableHash(input)}` as ReceiptId;
}

function acceptedKey(sessionIdValue: WorkSessionId, sourceDigest: string): string {
  return `${sessionIdValue}:${sourceDigest}`;
}

function defaultSnapshot(): ReportingSnapshot {
  return {
    schemaVersion: 1,
    sessions: [],
    receipts: [],
    drafts: [],
    acceptedReports: [],
  };
}

/** Creates the host-neutral reporting capability with hidden in-memory persistence. */
export function createReportingEngine(options: ReportingOptions = {}): WorkSessionReporting {
  const parsedSnapshot = options.initialSnapshot === undefined
    ? { success: true as const, data: defaultSnapshot() }
    : reportingSnapshotSchema.safeParse(options.initialSnapshot);
  if (!parsedSnapshot.success) {
    throw new Error(`Invalid reporting snapshot: ${issues(parsedSnapshot).join('; ')}`);
  }
  const now = options.now ?? (() => new Date().toISOString());
  const sessions = new Map(parsedSnapshot.data.sessions.map((session) => [session.id, session]));
  const receipts = new Map(parsedSnapshot.data.receipts.map((receipt) => [receipt.id, receipt]));
  const drafts = new Map(parsedSnapshot.data.drafts.map((draft) => [draft.id, draft]));
  const accepted = new Map(
    parsedSnapshot.data.acceptedReports.map((report) => [
      acceptedKey(report.sessionId, report.sourceDigest),
      report,
    ]),
  );

  const api: WorkSessionReporting = {
    importSession(input) {
      const parsed = importSessionInputSchema.safeParse(input);
      if (!parsed.success) return validationFailure(issues(parsed));
      const id = sessionId(parsed.data.provider, parsed.data.nativeSessionId);
      const existing = sessions.get(id);
      if (existing?.sourceDigest === parsed.data.sourceDigest) return { ok: true, value: existing };
      const uniqueEvents = [...new Map(
        parsed.data.events.map((event) => [event.providerEventId, event]),
      ).values()];
      const createdAt = existing?.createdAt ?? parsed.data.startedAt ?? now();
      const session: WorkSession = {
        schemaVersion: 1,
        id,
        kind: 'work-session',
        createdAt,
        ...parsed.data,
        events: uniqueEvents,
      };
      sessions.set(id, session);
      return { ok: true, value: session };
    },

    recordReceipt(input) {
      const parsed = recordReceiptInputSchema.safeParse(input);
      if (!parsed.success) return validationFailure(issues(parsed));
      if (!sessions.has(parsed.data.sessionId)) {
        return failure('SessionNotFound', `Session ${parsed.data.sessionId} does not exist.`);
      }
      const id = receiptId(parsed.data);
      const existing = receipts.get(id);
      if (existing) return { ok: true, value: existing };
      const receipt: WorkReceipt = {
        schemaVersion: 1,
        id,
        kind: 'work-receipt',
        createdAt: parsed.data.occurredAt ?? now(),
        ...parsed.data,
      };
      receipts.set(id, receipt);
      return { ok: true, value: receipt };
    },

    compileReport(input) {
      const parsed = compileReportInputSchema.safeParse(input);
      if (!parsed.success) return validationFailure(issues(parsed));
      const session = sessions.get(parsed.data.sessionId);
      if (!session) {
        return failure('SessionNotFound', `Session ${parsed.data.sessionId} does not exist.`);
      }
      if (!session.complete) {
        return failure('IncompleteSession', 'Incomplete sessions cannot produce an accepted report.');
      }
      const sessionReceipts = [...receipts.values()]
        .filter((receipt) => receipt.sessionId === session.id)
        .sort((left, right) => left.id.localeCompare(right.id));
      const projection = compileProjection(session, sessionReceipts, parsed.data);
      const existing = drafts.get(projection.reportRevisionId);
      if (existing) return { ok: true, value: existing };
      const draft: ReportDraft = {
        schemaVersion: 1,
        id: projection.reportRevisionId,
        kind: 'report-draft',
        createdAt: session.updatedAt ?? session.createdAt,
        sessionId: session.id,
        sourceDigest: session.sourceDigest,
        projection,
      };
      drafts.set(draft.id, draft);
      return { ok: true, value: draft };
    },

    acceptReport(input) {
      const parsed = acceptReportInputSchema.safeParse(input);
      if (!parsed.success) return validationFailure(issues(parsed));
      const draft = drafts.get(parsed.data.reportRevisionId);
      if (!draft) {
        return failure('DraftNotFound', `Draft ${parsed.data.reportRevisionId} does not exist.`);
      }
      const session = sessions.get(draft.sessionId);
      if (!session) {
        return failure('SessionNotFound', `Session ${draft.sessionId} does not exist.`);
      }
      if (
        session.sourceDigest !== parsed.data.expectedSourceDigest
        || draft.sourceDigest !== parsed.data.expectedSourceDigest
      ) {
        return failure('StaleDraft', 'The session changed after this report was compiled.', {
          currentSourceDigest: session.sourceDigest,
        });
      }
      const key = acceptedKey(session.id, session.sourceDigest);
      const existing = accepted.get(key);
      if (existing) {
        if (existing.id === draft.id) return { ok: true, value: existing };
        return failure('AlreadyAccepted', 'This source version already has an accepted report.', {
          acceptedReportRevisionId: existing.id,
        });
      }
      const report: AcceptedReport = {
        schemaVersion: 1,
        id: draft.id,
        kind: 'accepted-report',
        createdAt: draft.createdAt,
        acceptedAt: now(),
        sessionId: draft.sessionId,
        sourceDigest: draft.sourceDigest,
        projection: {
          ...draft.projection,
          workflow: draft.projection.workflow.map((step) => step.id === 'accept-report'
            ? { ...step, status: 'done' }
            : step),
        },
      };
      accepted.set(key, report);
      return { ok: true, value: report };
    },

    listReports() {
      return [...accepted.values()].sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt));
    },

    readReport(reportRevisionId: ReportRevisionId) {
      const report = [...accepted.values()].find((candidate) => candidate.id === reportRevisionId);
      return report
        ? { ok: true, value: report }
        : failure('ReportNotFound', `Accepted report ${reportRevisionId} does not exist.`);
    },

    readProjection(workSessionId: WorkSessionId) {
      const session = sessions.get(workSessionId);
      if (!session) return failure('SessionNotFound', `Session ${workSessionId} does not exist.`);
      const report = accepted.get(acceptedKey(workSessionId, session.sourceDigest));
      return report
        ? { ok: true, value: report.projection }
        : failure('ReportNotFound', `Session ${workSessionId} has no accepted current report.`);
    },

    snapshot() {
      return {
        schemaVersion: 1,
        sessions: [...sessions.values()],
        receipts: [...receipts.values()],
        drafts: [...drafts.values()],
        acceptedReports: [...accepted.values()],
      };
    },
  };
  return api;
}
