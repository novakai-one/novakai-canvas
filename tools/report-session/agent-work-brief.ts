import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  digestSchema,
  evidenceRefSchema,
  moduleRefSchema,
  nextActionSchema,
  outcomeSchema,
  renderingProfileSchema,
  type CompileReportInput,
  type RecordReceiptInput,
  type WorkSession,
} from '../../src/capabilities/work-session-reporting/index.ts';

const repositoryPathSchema = z.string()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9._/-]+$/)
  .refine((value) => !value.startsWith('/') && !value.split('/').includes('..'), {
    message: 'Changed files must be repository-relative paths.',
  });

const claimFields = {
  occurredAt: z.iso.datetime({ offset: true }).nullable().default(null),
  evidence: z.array(evidenceRefSchema).max(50).default([]),
  module: moduleRefSchema.optional(),
  relatedModules: z.array(moduleRefSchema).max(20).default([]),
  tags: z.array(z.string().min(1).max(80)).max(29).default([]),
};

const changeClaimSchema = z.object({
  title: z.string().min(1).max(180),
  module: moduleRefSchema,
  relatedModules: claimFields.relatedModules,
  files: z.array(repositoryPathSchema).min(1).max(50),
  why: z.string().min(1).max(500),
  before: z.string().min(1).max(500),
  after: z.string().min(1).max(500),
  occurredAt: claimFields.occurredAt,
  evidence: claimFields.evidence,
  tags: claimFields.tags,
}).strict();

const decisionClaimSchema = z.object({
  title: z.string().min(1).max(180),
  rationale: z.string().min(1).max(1_000),
  ...claimFields,
}).strict();

const problemClaimSchema = z.object({
  problem: z.string().min(1).max(500),
  resolution: z.string().min(1).max(1_000),
  ...claimFields,
}).strict();

const artifactClaimSchema = z.object({
  title: z.string().min(1).max(180),
  whatYouHaveNow: z.string().min(1).max(1_000),
  ...claimFields,
}).strict();

export const agentWorkBriefSchema = z.object({
  schemaVersion: z.literal(2),
  source: z.object({
    provider: z.enum(['codex', 'claude']),
    nativeSessionId: z.string().min(1).max(500),
    expectedSourceDigest: digestSchema.optional(),
  }).strict(),
  outcome: outcomeSchema,
  changes: z.array(changeClaimSchema).min(1).max(100),
  decisions: z.array(decisionClaimSchema).max(100).default([]),
  problems: z.array(problemClaimSchema).max(100).default([]),
  artifacts: z.array(artifactClaimSchema).min(1).max(100),
  remainingWork: z.array(nextActionSchema).max(50).default([]),
  renderingProfile: renderingProfileSchema.optional(),
}).strict();

export type AgentWorkBrief = z.infer<typeof agentWorkBriefSchema>;

export interface LoadedAgentWorkBrief {
  policy: Pick<CompileReportInput, 'outcome' | 'nextActions' | 'renderingProfile'>;
  receipts: RecordReceiptInput[];
}

/**
 * Validates an agent-authored claim brief and binds every receipt to the
 * authoritative imported session. Proof receipts are deliberately impossible.
 */
export function loadAgentWorkBrief(
  filePath: string,
  session: WorkSession,
): LoadedAgentWorkBrief {
  const brief = agentWorkBriefSchema.parse(
    JSON.parse(readFileSync(filePath, 'utf8')) as unknown,
  );
  if (
    brief.source.provider !== session.provider
    || brief.source.nativeSessionId !== session.nativeSessionId
  ) {
    throw new Error('AgentBriefSourceMismatch: brief provider/session identity does not match.');
  }
  if (
    brief.source.expectedSourceDigest
    && brief.source.expectedSourceDigest !== session.sourceDigest
  ) {
    throw new Error('AgentBriefSourceMismatch: brief expected source digest does not match.');
  }
  const bind = (
    receipt: Omit<RecordReceiptInput, 'sessionId' | 'occurredAt'> & {
      occurredAt?: string | null;
    },
  ): RecordReceiptInput => ({
    ...receipt,
    sessionId: session.id,
    occurredAt: receipt.occurredAt ?? null,
    tags: [...new Set([...(receipt.tags ?? []), 'agent-authored'])].sort(),
  });
  return {
    policy: {
      outcome: brief.outcome,
      nextActions: brief.remainingWork,
      renderingProfile: brief.renderingProfile,
    },
    receipts: [
      ...brief.changes.map((claim) => bind({
        type: 'change',
        title: claim.title,
        summary: `Before — ${claim.before} After — ${claim.after} Why — ${claim.why}`,
        changeNarrative: {
          why: claim.why,
          before: claim.before,
          after: claim.after,
        },
        occurredAt: claim.occurredAt,
        module: claim.module,
        relatedModules: claim.relatedModules,
        evidence: [
          ...claim.files.map((path) => ({
            kind: 'file' as const,
            label: path,
            uri: `repo:${path}`,
          })),
          ...claim.evidence,
        ],
        tags: claim.tags,
      })),
      ...brief.decisions.map((claim) => bind({
        type: 'decision',
        title: claim.title,
        summary: claim.rationale,
        occurredAt: claim.occurredAt,
        module: claim.module,
        relatedModules: claim.relatedModules,
        evidence: claim.evidence,
        tags: claim.tags,
      })),
      ...brief.problems.map((claim) => bind({
        type: 'decision',
        title: `Problem resolved — ${claim.problem}`,
        summary: `Problem — ${claim.problem} Resolution — ${claim.resolution}`,
        occurredAt: claim.occurredAt,
        module: claim.module,
        relatedModules: claim.relatedModules,
        evidence: claim.evidence,
        tags: [...claim.tags, 'problem-resolution'],
      })),
      ...brief.artifacts.map((claim) => bind({
        type: 'artifact',
        title: claim.title,
        summary: `You now have — ${claim.whatYouHaveNow}`,
        occurredAt: claim.occurredAt,
        module: claim.module,
        relatedModules: claim.relatedModules,
        evidence: claim.evidence,
        tags: claim.tags,
      })),
    ],
  };
}
