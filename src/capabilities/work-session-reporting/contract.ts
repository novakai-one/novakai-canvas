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

export const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const workSessionIdSchema = z.string().regex(/^session:[0-9a-f]{64}$/).transform(
  (value) => value as WorkSessionId,
);
export const receiptIdSchema = z.string().regex(/^receipt:[0-9a-f]{64}$/).transform(
  (value) => value as ReceiptId,
);
export const reportRevisionIdSchema = z.string().regex(/^report:[0-9a-f]{64}$/).transform(
  (value) => value as ReportRevisionId,
);

const timestampSchema = z.iso.datetime({ offset: true });

export const evidenceRefSchema = z.object({
  kind: z.enum(['file', 'commit', 'test', 'artifact', 'url']),
  label: z.string().min(1).max(160),
  uri: z.string().min(1).max(2_000),
  detail: z.string().max(500).optional(),
}).strict();
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const sessionEventSchema = z.object({
  providerEventId: z.string().min(1).max(500),
  role: z.enum(['user', 'assistant']),
  timestamp: timestampSchema.nullable(),
  summary: z.string().min(1).max(1_000),
}).strict();
export type SessionEvent = z.infer<typeof sessionEventSchema>;

export const sessionWarningSchema = z.object({
  code: z.enum([
    'MalformedLine',
    'MissingMetadata',
    'UnsupportedContent',
    'ConflictingEventId',
  ]),
  line: z.number().int().positive().nullable(),
  message: z.string().min(1).max(500),
}).strict();
export type SessionWarning = z.infer<typeof sessionWarningSchema>;

export const importSessionInputSchema = z.object({
  provider: z.enum(['codex', 'claude']),
  nativeSessionId: z.string().min(1).max(500),
  sourceDigest: digestSchema,
  sourceRef: z.string().min(1).max(2_000),
  title: z.string().min(1).max(180),
  startedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema.nullable(),
  complete: z.boolean(),
  warnings: z.array(sessionWarningSchema).max(1_000).default([]),
  events: z.array(sessionEventSchema).max(10_000),
}).strict();
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
}).strict();
export type ModuleRef = z.infer<typeof moduleRefSchema>;

export const executedProofSchema = z.object({
  command: z.string().min(1).max(500),
  exitCode: z.number().int(),
  executedAt: timestampSchema,
  outputDigest: digestSchema,
  outputExcerpt: z.string().max(4_000),
}).strict();
export type ExecutedProof = z.infer<typeof executedProofSchema>;

const receiptFields = {
  sessionId: workSessionIdSchema,
  type: receiptTypeSchema,
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(1_200),
  occurredAt: timestampSchema.nullable(),
  evidence: z.array(evidenceRefSchema).max(50).default([]),
  module: moduleRefSchema.optional(),
  relatedModules: z.array(moduleRefSchema).max(20).default([]),
  tags: z.array(z.string().min(1).max(80)).max(30).default([]),
  proof: executedProofSchema.optional(),
};

function requireProof(
  value: { type: z.infer<typeof receiptTypeSchema>; proof?: z.infer<typeof executedProofSchema> },
  context: z.RefinementCtx,
): void {
  if (value.type === 'proof' && value.proof === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['proof'],
      message: 'Proof receipts require an executed command receipt.',
    });
  }
  if (value.type !== 'proof' && value.proof !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['proof'],
      message: 'Only proof receipts may carry executed command evidence.',
    });
  }
}

export const recordReceiptInputSchema = z.object(receiptFields).strict().superRefine(requireProof);
export type RecordReceiptInput = z.infer<typeof recordReceiptInputSchema>;

export const outcomeSchema = z.object({
  status: z.enum(['complete', 'partial', 'blocked']),
  headline: z.string().min(1).max(180),
  summary: z.string().min(1).max(1_200),
}).strict();
export type ReportOutcome = z.infer<typeof outcomeSchema>;

export const nextActionSchema = z.object({
  id: z.string().min(1).max(180),
  label: z.string().min(1).max(220),
  status: z.enum(['next', 'queued', 'blocked']),
  dependsOn: z.array(z.string().min(1).max(180)).max(20).default([]),
}).strict();
export type NextAction = z.infer<typeof nextActionSchema>;

export const compileReportInputSchema = z.object({
  sessionId: workSessionIdSchema,
  outcome: outcomeSchema,
  nextActions: z.array(nextActionSchema).max(50).default([]),
}).strict();
export type CompileReportInput = z.infer<typeof compileReportInputSchema>;

export const acceptReportInputSchema = z.object({
  reportRevisionId: reportRevisionIdSchema,
  expectedSourceDigest: digestSchema,
  expectedReceiptsDigest: digestSchema,
}).strict();
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
  sourceDigest: digestSchema,
  sourceRef: z.string().min(1),
  title: z.string().min(1),
  startedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema.nullable(),
  complete: z.boolean(),
  warnings: z.array(sessionWarningSchema),
  events: z.array(sessionEventSchema),
}).strict();
export type WorkSession = z.infer<typeof workSessionSchema>;

export const workReceiptSchema = authoritativeRecordSchema.extend({
  id: receiptIdSchema,
  kind: z.literal('work-receipt'),
  sourceDigest: digestSchema,
  ...receiptFields,
}).strict().superRefine(requireProof);
export type WorkReceipt = z.infer<typeof workReceiptSchema>;

export const reportNodeSchema = moduleRefSchema.extend({
  receiptCount: z.number().int().nonnegative(),
}).strict();
export type ReportNode = z.infer<typeof reportNodeSchema>;

export const reportEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['calls', 'produces', 'renders', 'proves', 'changes']),
}).strict();
export type ReportEdge = z.infer<typeof reportEdgeSchema>;

const workflowStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  status: z.enum(['done', 'active', 'next', 'blocked']),
}).strict();

export const reportProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  reportRevisionId: reportRevisionIdSchema,
  sessionId: workSessionIdSchema,
  sourceDigest: digestSchema,
  receiptsDigest: digestSchema,
  title: z.string().min(1),
  source: z.object({
    provider: z.enum(['codex', 'claude']),
    startedAt: timestampSchema.nullable(),
    updatedAt: timestampSchema.nullable(),
    eventCount: z.number().int().nonnegative(),
    complete: z.boolean(),
    warningCount: z.number().int().nonnegative(),
  }).strict(),
  outcome: outcomeSchema,
  stats: z.object({
    changes: z.number().int().nonnegative(),
    decisions: z.number().int().nonnegative(),
    proofs: z.number().int().nonnegative(),
    blockers: z.number().int().nonnegative(),
    artifacts: z.number().int().nonnegative(),
  }).strict(),
  changeMap: z.object({
    nodes: z.array(reportNodeSchema),
    edges: z.array(reportEdgeSchema),
  }).strict(),
  workflow: z.array(workflowStepSchema),
  proofs: z.array(workReceiptSchema),
  decisions: z.array(workReceiptSchema),
  blockers: z.array(workReceiptSchema),
  artifacts: z.array(workReceiptSchema),
  nextActions: z.array(nextActionSchema),
  evidence: z.array(evidenceRefSchema),
}).strict();
/**
 * Disposable projection. Embedded receipts are immutable derived copies and
 * must reconcile byte-for-byte with the authoritative receipt IDs on the owner.
 */
export type ReportProjection = z.infer<typeof reportProjectionSchema>;

export const reportDraftSchema = authoritativeRecordSchema.extend({
  id: reportRevisionIdSchema,
  kind: z.literal('report-draft'),
  sessionId: workSessionIdSchema,
  sourceDigest: digestSchema,
  receiptIds: z.array(receiptIdSchema).max(10_000),
  receiptsDigest: digestSchema,
  projectionDigest: digestSchema,
  projection: reportProjectionSchema,
}).strict();
export type ReportDraft = z.infer<typeof reportDraftSchema>;

export const acceptedReportSchema = authoritativeRecordSchema.extend({
  id: reportRevisionIdSchema,
  kind: z.literal('accepted-report'),
  sessionId: workSessionIdSchema,
  sourceDigest: digestSchema,
  receiptIds: z.array(receiptIdSchema).max(10_000),
  receiptsDigest: digestSchema,
  projectionDigest: digestSchema,
  acceptedAt: timestampSchema,
  projection: reportProjectionSchema,
}).strict();
export type AcceptedReport = z.infer<typeof acceptedReportSchema>;

export const reportingSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  sessions: z.array(workSessionSchema),
  receipts: z.array(workReceiptSchema),
  drafts: z.array(reportDraftSchema),
  acceptedReports: z.array(acceptedReportSchema),
}).strict();
export type ReportingSnapshot = z.infer<typeof reportingSnapshotSchema>;

const visualHandoverPath = 'docs/visual-reporting/Novakai-Visual-Reporting-Handover.html';
const acceptedReportHtmlPathPattern =
  /^docs\/visual-reporting\/reports\/report-[0-9a-f]{64}\.html$/;

const repositoryRelativeHtmlPathSchema = z.string()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9._/-]+$/)
  .refine((value) => !value.startsWith('/') && !value.split('/').includes('..'), {
    message: 'Published artifact links must be repository-relative.',
  })
  .refine((value) => value.endsWith('.html'), {
    message: 'Published artifact links must select local HTML.',
  });

export const publishedArtifactHrefSchema = repositoryRelativeHtmlPathSchema
  .refine(
    (value) => value === visualHandoverPath || acceptedReportHtmlPathPattern.test(value),
    { message: 'Published artifact links must select an approved local HTML artifact.' },
  );

const publishedEvidenceSchema = evidenceRefSchema.pick({ kind: true, label: true }).extend({
  href: publishedArtifactHrefSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.href && value.kind !== 'artifact' && value.kind !== 'file') {
    context.addIssue({
      code: 'custom',
      path: ['href'],
      message: 'Only published file or artifact evidence may link to approved local HTML.',
    });
  }
});
export type PublishedEvidence = z.infer<typeof publishedEvidenceSchema>;

const publishedExecutedProofSchema = executedProofSchema.omit({ outputExcerpt: true }).strict();
export type PublishedExecutedProof = z.infer<typeof publishedExecutedProofSchema>;

export const publishedReceiptSchema = z.object({
  id: receiptIdSchema,
  sourceDigest: digestSchema,
  type: receiptTypeSchema,
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(1_200),
  evidence: z.array(publishedEvidenceSchema),
  proof: publishedExecutedProofSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.type === 'proof' && value.proof === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['proof'],
      message: 'Published proof receipts require structured executed proof.',
    });
  }
  if (value.type !== 'proof' && value.proof !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['proof'],
      message: 'Only published proof receipts may carry executed proof.',
    });
  }
});
export type PublishedReceipt = z.infer<typeof publishedReceiptSchema>;

export const publishedReceiptClaimSchema = z.object({
  id: receiptIdSchema,
  sourceDigest: digestSchema,
  type: receiptTypeSchema,
  proof: publishedExecutedProofSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.type === 'proof' && value.proof === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['proof'],
      message: 'Published proof claims require structured executed proof.',
    });
  }
  if (value.type !== 'proof' && value.proof !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['proof'],
      message: 'Only published proof claims may carry executed proof.',
    });
  }
});
export type PublishedReceiptClaim = z.infer<typeof publishedReceiptClaimSchema>;

export const publishedReportProjectionSchema = reportProjectionSchema.omit({
  sessionId: true,
  proofs: true,
  decisions: true,
  blockers: true,
  artifacts: true,
  evidence: true,
}).extend({
  proofs: z.array(publishedReceiptSchema),
  decisions: z.array(publishedReceiptSchema),
  blockers: z.array(publishedReceiptSchema),
  artifacts: z.array(publishedReceiptSchema),
  evidence: z.array(publishedEvidenceSchema),
}).strict();
export type PublishedReportProjection = z.infer<typeof publishedReportProjectionSchema>;

export const publishedEvidenceHeadSchema = z.object({
  commit: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/),
  tree: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/),
}).strict();
export type PublishedEvidenceHead = z.infer<typeof publishedEvidenceHeadSchema>;

export const publishedAcceptedReportEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('accepted-report-publication'),
  publicationDigest: digestSchema,
  publishedAt: timestampSchema,
  reportRevisionId: reportRevisionIdSchema,
  sourceDigest: digestSchema,
  receiptIds: z.array(receiptIdSchema).max(10_000),
  receiptClaims: z.array(publishedReceiptClaimSchema).max(10_000),
  receiptsDigest: digestSchema,
  authoritativeProjectionDigest: digestSchema,
  publicProjectionDigest: digestSchema,
  acceptedAt: timestampSchema,
  evidenceHead: publishedEvidenceHeadSchema,
  html: z.object({
    path: repositoryRelativeHtmlPathSchema,
    digest: digestSchema,
  }).strict(),
  projection: publishedReportProjectionSchema,
}).strict();
export type PublishedAcceptedReportEnvelope = z.infer<typeof publishedAcceptedReportEnvelopeSchema>;

export type ReportingFailureCode =
  | 'ValidationFailed'
  | 'IdentityConflict'
  | 'SessionNotFound'
  | 'DraftNotFound'
  | 'ReportNotFound'
  | 'IncompleteSession'
  | 'CompletionPolicyFailed'
  | 'StaleDraft'
  | 'StaleReceipts'
  | 'AlreadyAccepted';

export interface ReportingFailure {
  code: ReportingFailureCode;
  message: string;
  issues?: string[];
  currentSourceDigest?: string;
  currentReceiptsDigest?: string;
  acceptedReportRevisionId?: ReportRevisionId;
}

export type ReportingResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ReportingFailure };

/**
 * Host-neutral local reporting authority.
 *
 * Acceptance records local operator confirmation only. It is intentionally not
 * an authenticated actor or multi-user authorization decision.
 */
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
