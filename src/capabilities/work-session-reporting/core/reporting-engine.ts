import {
  acceptReportInputSchema,
  compileReportInputSchema,
  importSessionInputSchema,
  recordReceiptInputSchema,
  reportingSnapshotSchema,
  type AcceptedReport,
  type ImportSessionInput,
  type ReportDraft,
  type ReportProjection,
  type ReportRevisionId,
  type ReportingFailure,
  type ReportingResult,
  type ReportingSnapshot,
  type ReceiptId,
  type SessionEvent,
  type WorkReceipt,
  type WorkSession,
  type WorkSessionId,
  type WorkSessionReporting,
} from '../contract.ts';
import { compileProjection } from './report-compiler.ts';
import { stableHash, stableJson } from './stable-value.ts';

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

function receiptIdentity(value: {
  sessionId: WorkSessionId;
  sourceDigest: string;
  type: string;
  title: string;
  summary: string;
  occurredAt: string | null;
  evidence: unknown;
  module?: unknown;
  relatedModules: unknown;
  tags: unknown;
  changeNarrative?: unknown;
  proof?: unknown;
}): unknown {
  return {
    sessionId: value.sessionId,
    sourceDigest: value.sourceDigest,
    type: value.type,
    title: value.title,
    summary: value.summary,
    occurredAt: value.occurredAt,
    evidence: value.evidence,
    module: value.module,
    relatedModules: value.relatedModules,
    tags: value.tags,
    changeNarrative: value.changeNarrative,
    proof: value.proof,
  };
}

function receiptId(value: Parameters<typeof receiptIdentity>[0]): ReceiptId {
  return `receipt:${stableHash(receiptIdentity(value))}` as ReceiptId;
}

function receiptsFor(
  receipts: ReadonlyMap<ReceiptId, WorkReceipt>,
  session: WorkSession,
): WorkReceipt[] {
  return [...receipts.values()]
    .filter((receipt) => receipt.sessionId === session.id && receipt.sourceDigest === session.sourceDigest)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function receiptsDigest(receipts: readonly WorkReceipt[]): string {
  return `sha256:${stableHash(
    receipts.map((receipt) => ({ id: receipt.id, sourceDigest: receipt.sourceDigest })),
  )}`;
}

function projectionDigest(projection: ReportProjection): string {
  return `sha256:${stableHash(projection)}`;
}

function acceptedKey(sessionIdValue: WorkSessionId, sourceDigest: string, receiptDigest: string): string {
  return `${sessionIdValue}:${sourceDigest}:${receiptDigest}`;
}

function defaultSnapshot(): ReportingSnapshot {
  return {
    schemaVersion: 1,
    revision: 0,
    sessions: [],
    receipts: [],
    drafts: [],
    acceptedReports: [],
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function cloneFrozen<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function duplicateValues<T extends { id: string }>(records: readonly T[], label: string): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const record of records) {
    if (seen.has(record.id)) errors.push(`Duplicate ${label} id ${record.id}.`);
    seen.add(record.id);
  }
  return errors;
}

function completionIssues(
  session: WorkSession,
  receipts: readonly WorkReceipt[],
  projection: ReportProjection,
): string[] {
  if (projection.outcome.status !== 'complete') return [];
  const errors: string[] = [];
  if (!session.complete) errors.push('claims completion for an incomplete source');
  if (session.events.length === 0) errors.push('claims completion with zero normalized events');
  if (session.warnings.length > 0) errors.push('claims completion with parser warnings');
  const proofs = receipts.filter((receipt) => receipt.type === 'proof');
  if (proofs.length === 0) {
    errors.push('claims completion without successful executed proof reconciled to authority');
  } else if (proofs.some((receipt) => receipt.proof?.exitCode !== 0)) {
    errors.push('claims completion with a non-successful executed proof reconciled to authority');
  }
  if (receipts.some((receipt) => receipt.type === 'blocker')) {
    errors.push('claims completion with authoritative blockers');
  }
  if (projection.nextActions.some((action) => action.status === 'next' || action.status === 'blocked')) {
    errors.push('claims completion with unresolved next actions');
  }
  return errors;
}

function assertStoredProjection(
  owner: {
    id: ReportRevisionId;
    sessionId: WorkSessionId;
    sourceDigest: string;
    receiptIds: readonly ReceiptId[];
    receiptsDigest: string;
    projectionDigest: string;
    projection: ReportProjection;
  },
  label: string,
  sessions: ReadonlyMap<WorkSessionId, WorkSession>,
  authoritativeReceipts: ReadonlyMap<ReceiptId, WorkReceipt>,
): string[] {
  const projection = owner.projection;
  const errors = [
    ...duplicateValues(projection.changeMap.nodes, `${label} node`),
    ...duplicateValues(projection.changeMap.edges, `${label} edge`),
    ...duplicateValues(projection.workflow, `${label} workflow step`),
    ...duplicateValues(projection.nextActions, `${label} next action`),
  ];
  const session = sessions.get(owner.sessionId);
  if (!session) {
    errors.push(`${label} references a missing session.`);
    return errors;
  }
  if (owner.sourceDigest !== session.sourceDigest) {
    errors.push(`${label} source digest disagrees with its authoritative session.`);
  }
  if (projection.reportRevisionId !== owner.id) {
    errors.push(`${label} projection report id disagrees.`);
  }
  if (projection.sessionId !== owner.sessionId) {
    errors.push(`${label} projection session id disagrees.`);
  }
  if (projection.sourceDigest !== owner.sourceDigest) {
    errors.push(`${label} projection source digest disagrees.`);
  }
  if (projection.receiptsDigest !== owner.receiptsDigest) {
    errors.push(`${label} projection receipts digest disagrees.`);
  }
  const nodeIds = new Set(projection.changeMap.nodes.map((node) => node.id));
  for (const edge of projection.changeMap.edges) {
    if (!nodeIds.has(edge.source)) errors.push(`${label} edge ${edge.id} has dangling source ${edge.source}.`);
    if (!nodeIds.has(edge.target)) errors.push(`${label} edge ${edge.id} has dangling target ${edge.target}.`);
  }
  const seenReceiptIds = new Set<ReceiptId>();
  const receipts: WorkReceipt[] = [];
  for (const receiptIdValue of owner.receiptIds) {
    if (seenReceiptIds.has(receiptIdValue)) {
      errors.push(`${label} has duplicate authoritative receipt reference ${receiptIdValue}.`);
      continue;
    }
    seenReceiptIds.add(receiptIdValue);
    const receipt = authoritativeReceipts.get(receiptIdValue);
    if (!receipt) {
      errors.push(`${label} references missing authoritative receipt ${receiptIdValue}.`);
      continue;
    }
    if (receipt.sessionId !== owner.sessionId) {
      errors.push(`${label} references a receipt for another session.`);
    }
    if (receipt.sourceDigest !== owner.sourceDigest) {
      errors.push(`${label} references a receipt for another source.`);
    }
    receipts.push(receipt);
  }
  const sortedReceiptIds = [...owner.receiptIds].sort((left, right) => left.localeCompare(right));
  if (stableJson(owner.receiptIds) !== stableJson(sortedReceiptIds)) {
    errors.push(`${label} authoritative receipt references are not canonical.`);
  }
  if (errors.some((error) => error.includes('receipt'))) return errors;

  const expectedProjection = compileProjection(session, receipts, {
    sessionId: owner.sessionId,
    outcome: projection.outcome,
    nextActions: projection.nextActions,
    renderingProfile: projection.renderingProfile,
  });
  const expectedReceiptsDigest = receiptsDigest(receipts);
  const expectedProjectionDigest = projectionDigest(expectedProjection);
  if (owner.receiptsDigest !== expectedReceiptsDigest) {
    errors.push(`${label} receipts digest disagrees with authoritative receipts.`);
  }
  if (owner.id !== expectedProjection.reportRevisionId) {
    errors.push(`${label} report identity disagrees with authoritative inputs.`);
  }
  if (owner.projectionDigest !== expectedProjectionDigest) {
    errors.push(`${label} projection digest disagrees with authoritative inputs.`);
  }
  if (stableJson(projection) !== stableJson(expectedProjection)) {
    errors.push(`${label} projection is not the exact immutable derived copy of authoritative inputs.`);
  }
  errors.push(...completionIssues(session, receipts, projection).map((error) => `${label} ${error}.`));
  return errors;
}

function snapshotIntegrity(snapshot: ReportingSnapshot): string[] {
  const errors = [
    ...duplicateValues(snapshot.sessions, 'session'),
    ...duplicateValues(snapshot.receipts, 'receipt'),
    ...duplicateValues(snapshot.drafts, 'draft'),
    ...duplicateValues(snapshot.acceptedReports, 'accepted report'),
  ];
  const sessions = new Map(snapshot.sessions.map((session) => [session.id, session]));
  const receipts = new Map(snapshot.receipts.map((receipt) => [receipt.id, receipt]));
  const providerIdentities = new Set<string>();
  for (const session of snapshot.sessions) {
    if (session.id !== sessionId(session.provider, session.nativeSessionId)) {
      errors.push(`Session ${session.id} conflicts with its provider identity.`);
    }
    const providerIdentity = `${session.provider}:${session.nativeSessionId}`;
    if (providerIdentities.has(providerIdentity)) {
      errors.push(`Duplicate provider session identity ${providerIdentity}.`);
    }
    providerIdentities.add(providerIdentity);
    const eventIds = new Set<string>();
    for (const event of session.events) {
      if (eventIds.has(event.providerEventId)) {
        errors.push(`Session ${session.id} has duplicate provider event id ${event.providerEventId}.`);
      }
      eventIds.add(event.providerEventId);
    }
  }
  for (const receipt of snapshot.receipts) {
    const session = sessions.get(receipt.sessionId);
    if (!session) errors.push(`Receipt ${receipt.id} references a missing session.`);
    if (session && receipt.sourceDigest !== session.sourceDigest) {
      errors.push(`Receipt ${receipt.id} references a non-authoritative source version.`);
    }
    if (receipt.id !== receiptId(receipt)) errors.push(`Receipt ${receipt.id} conflicts with its content identity.`);
  }
  for (const draft of snapshot.drafts) {
    errors.push(...assertStoredProjection(draft, `Draft ${draft.id}`, sessions, receipts));
  }
  const acceptedKeys = new Set<string>();
  for (const report of snapshot.acceptedReports) {
    const key = acceptedKey(report.sessionId, report.sourceDigest, report.receiptsDigest);
    if (acceptedKeys.has(key)) errors.push(`Duplicate accepted key ${key}.`);
    acceptedKeys.add(key);
    errors.push(...assertStoredProjection(report, `Accepted report ${report.id}`, sessions, receipts));
  }
  return errors;
}

function normalizedEvents(events: readonly SessionEvent[]): ReportingResult<SessionEvent[]> {
  const unique = new Map<string, SessionEvent>();
  for (const event of events) {
    const existing = unique.get(event.providerEventId);
    if (existing && stableJson(existing) !== stableJson(event)) {
      return failure(
        'IdentityConflict',
        `Provider event id ${event.providerEventId} identifies conflicting content.`,
      );
    }
    if (!existing) unique.set(event.providerEventId, event);
  }
  return { ok: true, value: [...unique.values()] };
}

function sessionImportIdentity(session: WorkSession): ImportSessionInput {
  return {
    provider: session.provider,
    nativeSessionId: session.nativeSessionId,
    sourceDigest: session.sourceDigest,
    sourceRef: session.sourceRef,
    title: session.title,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    complete: session.complete,
    warnings: session.warnings,
    events: session.events,
  };
}

function sessionSourceIdentity(input: ImportSessionInput): Omit<ImportSessionInput, 'complete'> {
  const { complete: _complete, ...identity } = input;
  return identity;
}

/** Creates the host-neutral reporting capability with hidden in-memory persistence. */
export function createReportingEngine(options: ReportingOptions = {}): WorkSessionReporting {
  const parsedSnapshot = options.initialSnapshot === undefined
    ? { success: true as const, data: defaultSnapshot() }
    : reportingSnapshotSchema.safeParse(structuredClone(options.initialSnapshot));
  if (!parsedSnapshot.success) {
    throw new Error(`Invalid reporting snapshot: ${issues(parsedSnapshot).join('; ')}`);
  }
  const integrityErrors = snapshotIntegrity(parsedSnapshot.data);
  if (integrityErrors.length > 0) {
    throw new Error(`Invalid reporting snapshot: ${integrityErrors.join('; ')}`);
  }

  const now = options.now ?? (() => new Date().toISOString());
  let revision = parsedSnapshot.data.revision;
  const sessions = new Map(
    parsedSnapshot.data.sessions.map((session) => [session.id, cloneFrozen(session)]),
  );
  const receipts = new Map(
    parsedSnapshot.data.receipts.map((receipt) => [receipt.id, cloneFrozen(receipt)]),
  );
  const drafts = new Map(
    parsedSnapshot.data.drafts.map((draft) => [draft.id, cloneFrozen(draft)]),
  );
  const accepted = new Map(
    parsedSnapshot.data.acceptedReports.map((report) => [
      acceptedKey(report.sessionId, report.sourceDigest, report.receiptsDigest),
      cloneFrozen(report),
    ]),
  );

  function changed(): void {
    revision += 1;
  }

  function discardSupersededSourceVersion(sessionIdValue: WorkSessionId): void {
    for (const [id, receipt] of receipts) {
      if (receipt.sessionId === sessionIdValue) receipts.delete(id);
    }
    for (const [key, report] of accepted) {
      if (report.sessionId === sessionIdValue) accepted.delete(key);
    }
  }

  const api: WorkSessionReporting = {
    importSession(input) {
      const parsed = importSessionInputSchema.safeParse(input);
      if (!parsed.success) return validationFailure(issues(parsed));
      const events = normalizedEvents(parsed.data.events);
      if (!events.ok) return events;
      const normalizedInput = { ...parsed.data, events: events.value };
      const id = sessionId(normalizedInput.provider, normalizedInput.nativeSessionId);
      const existing = sessions.get(id);
      if (
        existing
        && existing.sourceDigest === normalizedInput.sourceDigest
        && stableJson(sessionSourceIdentity(sessionImportIdentity(existing)))
          !== stableJson(sessionSourceIdentity(normalizedInput))
      ) {
        return failure('IdentityConflict', `Session ${id} has conflicting content for one source digest.`);
      }
      if (existing?.sourceDigest === normalizedInput.sourceDigest) {
        if (!existing.complete && normalizedInput.complete) {
          const completed = cloneFrozen<WorkSession>({
            ...existing,
            complete: true,
          });
          sessions.set(id, completed);
          changed();
          return { ok: true, value: cloneFrozen(completed) };
        }
        return { ok: true, value: cloneFrozen(existing) };
      }
      if (existing) discardSupersededSourceVersion(id);
      const session = cloneFrozen<WorkSession>({
        schemaVersion: 1,
        id,
        kind: 'work-session',
        createdAt: existing?.createdAt ?? normalizedInput.startedAt ?? now(),
        ...normalizedInput,
      });
      sessions.set(id, session);
      changed();
      return { ok: true, value: cloneFrozen(session) };
    },

    recordReceipt(input) {
      const parsed = recordReceiptInputSchema.safeParse(input);
      if (!parsed.success) return validationFailure(issues(parsed));
      const session = sessions.get(parsed.data.sessionId);
      if (!session) {
        return failure('SessionNotFound', `Session ${parsed.data.sessionId} does not exist.`);
      }
      const identity = { ...parsed.data, sourceDigest: session.sourceDigest };
      const id = receiptId(identity);
      const existing = receipts.get(id);
      if (existing) {
        if (stableJson(receiptIdentity(existing)) !== stableJson(receiptIdentity(identity))) {
          return failure('IdentityConflict', `Receipt ${id} identifies conflicting content.`);
        }
        return { ok: true, value: cloneFrozen(existing) };
      }
      const receipt = cloneFrozen<WorkReceipt>({
        schemaVersion: 1,
        id,
        kind: 'work-receipt',
        createdAt: parsed.data.occurredAt ?? now(),
        sourceDigest: session.sourceDigest,
        ...parsed.data,
      });
      receipts.set(id, receipt);
      changed();
      return { ok: true, value: cloneFrozen(receipt) };
    },

    compileReport(input) {
      const parsed = compileReportInputSchema.safeParse(input);
      if (!parsed.success) return validationFailure(issues(parsed));
      const session = sessions.get(parsed.data.sessionId);
      if (!session) {
        return failure('SessionNotFound', `Session ${parsed.data.sessionId} does not exist.`);
      }
      if (!session.complete) {
        return failure('IncompleteSession', 'The session lacks an explicit completion signal.');
      }
      const sessionReceipts = receiptsFor(receipts, session);
      if (parsed.data.outcome.status === 'complete') {
        const candidateProjection = compileProjection(session, sessionReceipts, parsed.data);
        const policyIssues = completionIssues(session, sessionReceipts, candidateProjection);
        if (policyIssues.length > 0) {
          return failure(
            'CompletionPolicyFailed',
            'A complete outcome requires every executed proof to succeed and no unresolved work.',
            { issues: policyIssues },
          );
        }
      }
      const projection = cloneFrozen(compileProjection(session, sessionReceipts, parsed.data));
      const digest = projectionDigest(projection);
      const existing = drafts.get(projection.reportRevisionId);
      if (existing) {
        if (existing.projectionDigest !== digest) {
          return failure('IdentityConflict', `Report revision ${existing.id} identifies conflicting bytes.`);
        }
        return { ok: true, value: cloneFrozen(existing) };
      }
      const draft = cloneFrozen<ReportDraft>({
        schemaVersion: 1,
        id: projection.reportRevisionId,
        kind: 'report-draft',
        createdAt: session.updatedAt ?? session.createdAt,
        sessionId: session.id,
        sourceDigest: session.sourceDigest,
        receiptIds: sessionReceipts.map((receipt) => receipt.id),
        receiptsDigest: projection.receiptsDigest,
        projectionDigest: digest,
        projection,
      });
      drafts.set(draft.id, draft);
      changed();
      return { ok: true, value: cloneFrozen(draft) };
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
      const currentReceipts = receiptsFor(receipts, session);
      const policyIssues = completionIssues(session, currentReceipts, draft.projection);
      if (policyIssues.length > 0) {
        return failure(
          'CompletionPolicyFailed',
          'A complete outcome requires every executed proof to succeed and no unresolved work.',
          { issues: policyIssues },
        );
      }
      const currentReceiptsDigest = receiptsDigest(currentReceipts);
      if (
        currentReceiptsDigest !== parsed.data.expectedReceiptsDigest
        || draft.receiptsDigest !== parsed.data.expectedReceiptsDigest
      ) {
        return failure('StaleReceipts', 'Repository evidence changed after this report was compiled.', {
          currentReceiptsDigest,
        });
      }
      if (projectionDigest(draft.projection) !== draft.projectionDigest) {
        return failure('IdentityConflict', `Draft ${draft.id} projection bytes changed after compilation.`);
      }
      const key = acceptedKey(session.id, session.sourceDigest, currentReceiptsDigest);
      const existing = accepted.get(key);
      if (existing) {
        if (existing.id === draft.id) return { ok: true, value: cloneFrozen(existing) };
        return failure('AlreadyAccepted', 'This source and evidence version already has an accepted report.', {
          acceptedReportRevisionId: existing.id,
        });
      }
      const report = cloneFrozen<AcceptedReport>({
        schemaVersion: 1,
        id: draft.id,
        kind: 'accepted-report',
        createdAt: draft.createdAt,
        acceptedAt: now(),
        sessionId: draft.sessionId,
        sourceDigest: draft.sourceDigest,
        receiptIds: draft.receiptIds,
        receiptsDigest: draft.receiptsDigest,
        projectionDigest: draft.projectionDigest,
        projection: draft.projection,
      });
      accepted.set(key, report);
      changed();
      return { ok: true, value: cloneFrozen(report) };
    },

    listReports() {
      return cloneFrozen(
        [...accepted.values()].sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt)),
      );
    },

    readReport(reportRevisionId: ReportRevisionId) {
      const report = [...accepted.values()].find((candidate) => candidate.id === reportRevisionId);
      return report
        ? { ok: true, value: cloneFrozen(report) }
        : failure('ReportNotFound', `Accepted report ${reportRevisionId} does not exist.`);
    },

    readProjection(workSessionId: WorkSessionId) {
      const session = sessions.get(workSessionId);
      if (!session) return failure('SessionNotFound', `Session ${workSessionId} does not exist.`);
      const currentReceiptsDigest = receiptsDigest(receiptsFor(receipts, session));
      const report = accepted.get(acceptedKey(workSessionId, session.sourceDigest, currentReceiptsDigest));
      return report
        ? { ok: true, value: cloneFrozen(report.projection) }
        : failure('ReportNotFound', `Session ${workSessionId} has no accepted current report.`);
    },

    snapshot() {
      return cloneFrozen({
        schemaVersion: 1,
        revision,
        sessions: [...sessions.values()].sort((left, right) => left.id.localeCompare(right.id)),
        receipts: [...receipts.values()].sort((left, right) => left.id.localeCompare(right.id)),
        drafts: [...drafts.values()]
          .filter((draft) => sessions.get(draft.sessionId)?.sourceDigest === draft.sourceDigest)
          .sort((left, right) => left.id.localeCompare(right.id)),
        acceptedReports: [...accepted.values()].sort((left, right) => left.id.localeCompare(right.id)),
      });
    },
  };
  return api;
}
