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

const agentReceiptSchema = z.object({
  type: z.enum(['change', 'decision', 'blocker', 'artifact']),
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(1_200),
  occurredAt: z.iso.datetime({ offset: true }).nullable().default(null),
  evidence: z.array(evidenceRefSchema).max(50).default([]),
  module: moduleRefSchema.optional(),
  relatedModules: z.array(moduleRefSchema).max(20).default([]),
  tags: z.array(z.string().min(1).max(80)).max(29).default([]),
}).strict();

export const agentWorkBriefSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    provider: z.enum(['codex', 'claude']),
    nativeSessionId: z.string().min(1).max(500),
    expectedSourceDigest: digestSchema.optional(),
  }).strict(),
  outcome: outcomeSchema,
  nextActions: z.array(nextActionSchema).max(50).default([]),
  renderingProfile: renderingProfileSchema.optional(),
  receipts: z.array(agentReceiptSchema).min(1).max(100),
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
  return {
    policy: {
      outcome: brief.outcome,
      nextActions: brief.nextActions,
      renderingProfile: brief.renderingProfile,
    },
    receipts: brief.receipts.map((receipt) => ({
      ...receipt,
      sessionId: session.id,
      tags: [...new Set([...receipt.tags, 'agent-authored'])].sort(),
    })),
  };
}
