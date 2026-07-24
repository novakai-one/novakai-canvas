import { z } from 'zod';

declare const workSessionIdBrand: unique symbol;
declare const receiptIdBrand: unique symbol;
declare const reportRevisionIdBrand: unique symbol;

/** Opaque identity for one imported agent work session. */
export type WorkSessionId = string & { readonly [workSessionIdBrand]: true };
/** Opaque identity for one structured work receipt. */
export type ReceiptId = string & { readonly [receiptIdBrand]: true };
/** Opaque identity for one deterministic report revision. */
export type ReportRevisionId = string & { readonly [reportRevisionIdBrand]: true };

export const workSessionIdSchema = z.string().startsWith('session:').transform(
  (value) => value as WorkSessionId,
);
export const receiptIdSchema = z.string().startsWith('receipt:').transform(
  (value) => value as ReceiptId,
);
export const reportRevisionIdSchema = z.string().startsWith('report:').transform(
  (value) => value as ReportRevisionId,
);

const timestampSchema = z.iso.datetime({ offset: true });

export const evidenceRefSchema = z.object({
  kind: z.enum(['file', 'commit', 'test', 'artifact', 'url']),
  label: z.string().min(1).max(160),
  uri: z.string().min(1).max(2_000),
  detail: z.string().max(500).optional(),
});

export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const sessionEventSchema = z.object({
  providerEventId: z.string().min(1).max(500),
  role: z.enum(['user', 'assistant']),
  timestamp: timestampSchema.nullable(),
  summary: z.string().min(1).max(1_000),
});

export type SessionEvent = z.infer<typeof sessionEventSchema>;

export const importSessionInputSchema = z.object({
  provider: z.enum(['codex', 'claude']),
  nativeSessionId: z.string().min(1).max(500),
  sourceDigest: z.string().startsWith('sha256:'),
  sourceRef: z.string().min(1).max(2_000),
  title: z.string().min(1).max(180),
  startedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema.nullable(),
  complete: z.boolean(),
  events: z.array(sessionEventSchema).max(10_000),
});

export type ImportSessionInput = z.infer<typeof importSessionInputSchema>;

export const receiptTypeSchema = z.enum([
  'change',
  'decision',
  'proof',
  'blocker',
  'artifact',
]);

export type ReceiptType = z.infer<typeof receiptTypeSchema>;

export const moduleRefSchema = z.object({
  id: z.string().min(1).max(180),
  label: z.string().min(1).max(180),
  role: z.enum(['caller', 'interface', 'module', 'adapter', 'projection', 'store']),
});

export type ModuleRef = z.infer<typeof moduleRefSchema>;

export const recordReceiptInputSchema = z.object({
  sessionId: workSessionIdSchema,
  type: receiptTypeSchema,
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(1_200),
  occurredAt: timestampSchema.nullable(),
  evidence: z.array(evidenceRefSchema).max(50).default([]),
  module: moduleRefSchema.optional(),
  relatedModules: z.array(moduleRefSchema).max(20).default([]),
  tags: z.array(z.string().min(1).max(80)).max(30).default([]),
});

export type RecordReceiptInput = z.infer<typeof recordReceiptInputSchema>;

export const outcomeSchema = z.object({
  status: z.enum(['complete', 'partial', 'blocked']),
  headline: z.string().min(1).max(180),
  summary: z.string().min(1).max(1_200),
});

export type ReportOutcome = z.infer<typeof outcomeSchema>;

export const nextActionSchema = z.object({
  id: z.string().min(1).max(180),
  label: z.string().min(1).max(220),
  status: z.enum(['next', 'queued', 'blocked']),
  dependsOn: z.array(z.string().min(1).max(180)).max(20).default([]),
});

export type NextAction = z.infer<typeof nextActionSchema>;

export const compileReportInputSchema = z.object({
  sessionId: workSessionIdSchema,
  outcome: outcomeSchema,
  nextActions: z.array(nextActionSchema).max(50).default([]),
});

export type CompileReportInput = z.infer<typeof compileReportInputSchema>;

export const acceptReportInputSchema = z.object({
  reportRevisionId: reportRevisionIdSchema,
  expectedSourceDigest: z.string().startsWith('sha256:'),
});

export type AcceptReportInput = z.infer<typeof acceptReportInputSchema>;

const authoritativeRecordSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: timestampSchema,
});

export const workSessionSchema = authoritativeRecordSchema.extend({
  id: workSessionIdSchema,
  kind: z.literal('work-session'),
  provider: z.enum(['codex', 'claude']),
  nativeSessionId: z.string().min(1),
  sourceDigest: z.string().startsWith('sha256:'),
  sourceRef: z.string().min(1),
  title: z.string().min(1),
  startedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema.nullable(),
  complete: z.boolean(),
  events: z.array(sessionEventSchema),
});

export type WorkSession = z.infer<typeof workSessionSchema>;

export const workReceiptSchema = authoritativeRecordSchema.extend({
  id: receiptIdSchema,
  kind: z.literal('work-receipt'),
  sessionId: workSessionIdSchema,
  type: receiptTypeSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  occurredAt: timestampSchema.nullable(),
  evidence: z.array(evidenceRefSchema),
  module: moduleRefSchema.optional(),
  relatedModules: z.array(moduleRefSchema),
  tags: z.array(z.string()),
});

export type WorkReceipt = z.infer<typeof workReceiptSchema>;

export const reportNodeSchema = moduleRefSchema.extend({
  receiptCount: z.number().int().nonnegative(),
});

export type ReportNode = z.infer<typeof reportNodeSchema>;

export const reportEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['calls', 'produces', 'renders', 'proves', 'changes']),
});

export type ReportEdge = z.infer<typeof reportEdgeSchema>;

export const reportProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  reportRevisionId: reportRevisionIdSchema,
  sessionId: workSessionIdSchema,
  sourceDigest: z.string().startsWith('sha256:'),
  title: z.string().min(1),
  source: z.object({
    provider: z.enum(['codex', 'claude']),
    sourceRef: z.string().min(1),
    startedAt: timestampSchema.nullable(),
    updatedAt: timestampSchema.nullable(),
    eventCount: z.number().int().nonnegative(),
    complete: z.boolean(),
  }),
  outcome: outcomeSchema,
  stats: z.object({
    changes: z.number().int().nonnegative(),
    decisions: z.number().int().nonnegative(),
    proofs: z.number().int().nonnegative(),
    blockers: z.number().int().nonnegative(),
    artifacts: z.number().int().nonnegative(),
  }),
  changeMap: z.object({
    nodes: z.array(reportNodeSchema),
    edges: z.array(reportEdgeSchema),
  }),
  workflow: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    detail: z.string().min(1),
    status: z.enum(['done', 'active', 'next', 'blocked']),
  })),
  proofs: z.array(workReceiptSchema),
  decisions: z.array(workReceiptSchema),
  blockers: z.array(workReceiptSchema),
  artifacts: z.array(workReceiptSchema),
  nextActions: z.array(nextActionSchema),
  evidence: z.array(evidenceRefSchema),
});

export type ReportProjection = z.infer<typeof reportProjectionSchema>;

export const reportDraftSchema = authoritativeRecordSchema.extend({
  id: reportRevisionIdSchema,
  kind: z.literal('report-draft'),
  sessionId: workSessionIdSchema,
  sourceDigest: z.string().startsWith('sha256:'),
  projection: reportProjectionSchema,
});

export type ReportDraft = z.infer<typeof reportDraftSchema>;

export const acceptedReportSchema = authoritativeRecordSchema.extend({
  id: reportRevisionIdSchema,
  kind: z.literal('accepted-report'),
  sessionId: workSessionIdSchema,
  sourceDigest: z.string().startsWith('sha256:'),
  acceptedAt: timestampSchema,
  projection: reportProjectionSchema,
});

export type AcceptedReport = z.infer<typeof acceptedReportSchema>;

export const reportingSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  sessions: z.array(workSessionSchema),
  receipts: z.array(workReceiptSchema),
  drafts: z.array(reportDraftSchema),
  acceptedReports: z.array(acceptedReportSchema),
});

export type ReportingSnapshot = z.infer<typeof reportingSnapshotSchema>;

export type ReportingFailureCode =
  | 'ValidationFailed'
  | 'SessionNotFound'
  | 'DraftNotFound'
  | 'ReportNotFound'
  | 'IncompleteSession'
  | 'StaleDraft'
  | 'AlreadyAccepted';

export interface ReportingFailure {
  code: ReportingFailureCode;
  message: string;
  issues?: string[];
  currentSourceDigest?: string;
  acceptedReportRevisionId?: ReportRevisionId;
}

export type ReportingResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ReportingFailure };

export interface WorkSessionReporting {
  importSession(input: unknown): ReportingResult<WorkSession>;
  recordReceipt(input: unknown): ReportingResult<WorkReceipt>;
  compileReport(input: unknown): ReportingResult<ReportDraft>;
  acceptReport(input: unknown): ReportingResult<AcceptedReport>;
  listReports(): readonly AcceptedReport[];
  readReport(reportRevisionId: ReportRevisionId): ReportingResult<AcceptedReport>;
  readProjection(sessionId: WorkSessionId): ReportingResult<ReportProjection>;
  snapshot(): ReportingSnapshot;
}
