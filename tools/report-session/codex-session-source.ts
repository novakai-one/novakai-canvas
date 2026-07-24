import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { z } from 'zod';
import type { ImportSessionInput, SessionEvent } from '../../src/capabilities/work-session-reporting/contract.ts';

const textBlockSchema = z.object({
  type: z.enum(['input_text', 'output_text', 'text']),
  text: z.string(),
});

const contentBlockSchema = z.union([
  textBlockSchema,
  z.object({ type: z.string() }).passthrough(),
]);

const messagePayloadSchema = z.object({
  type: z.literal('message'),
  id: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  content: z.array(contentBlockSchema),
});

const sessionMetaSchema = z.object({
  type: z.literal('session_meta'),
  payload: z.object({
    id: z.string().optional(),
    session_id: z.string().optional(),
    timestamp: z.string().optional(),
  }).passthrough(),
});

const responseItemSchema = z.object({
  type: z.literal('response_item'),
  timestamp: z.string().optional(),
  payload: z.unknown(),
});

const genericRecordSchema = z.object({
  type: z.string(),
  timestamp: z.string().optional(),
}).passthrough();

interface ParsedLine {
  line: number;
  value: z.infer<typeof genericRecordSchema>;
}

function parseLines(source: string): { records: ParsedLine[]; complete: boolean } {
  const records: ParsedLine[] = [];
  let complete = true;
  for (const [index, line] of source.split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      const parsed = genericRecordSchema.safeParse(JSON.parse(line) as unknown);
      if (parsed.success) records.push({ line: index + 1, value: parsed.data });
      else complete = false;
    } catch {
      complete = false;
    }
  }
  return { records, complete };
}

function textFromBlock(block: z.infer<typeof contentBlockSchema>): string {
  const parsed = textBlockSchema.safeParse(block);
  return parsed.success ? parsed.data.text.trim() : '';
}

function isSynthetic(content: string): boolean {
  const value = content.trimStart();
  return [
    '# AGENTS.md instructions',
    '<environment_context>',
    '<permissions instructions>',
    '<collaboration_mode>',
    '<skills_instructions>',
    '<apps_instructions>',
    '<plugins_instructions>',
    '<codex_internal_context',
  ].some((prefix) => value.startsWith(prefix));
}

function compact(content: string, limit = 900): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

function fallbackId(filePath: string): string {
  const name = basename(filePath, '.jsonl');
  return name.match(/([0-9a-f]{8}-[0-9a-f-]{27,})$/i)?.[1] ?? name;
}

function sourceRef(filePath: string): string {
  const marker = `${process.platform === 'win32' ? '\\' : '/'}sessions${process.platform === 'win32' ? '\\' : '/'}`;
  const index = filePath.lastIndexOf(marker);
  return index >= 0 ? `$CODEX_HOME${filePath.slice(index)}` : `$CODEX_HOME/${basename(filePath)}`;
}

/** Parses one real Codex JSONL session into the reporting capability's public import contract. */
export function parseCodexSessionFile(filePath: string): ImportSessionInput {
  const source = readFileSync(filePath, 'utf8');
  const parsed = parseLines(source);
  const metaRecord = parsed.records
    .map((record) => sessionMetaSchema.safeParse(record.value))
    .find((result) => result.success);
  const metadata = metaRecord?.success ? metaRecord.data.payload : undefined;
  const nativeSessionId = metadata?.id ?? metadata?.session_id ?? fallbackId(filePath);
  const events: SessionEvent[] = [];
  let complete = parsed.complete && metadata !== undefined;

  for (const record of parsed.records) {
    const response = responseItemSchema.safeParse(record.value);
    if (!response.success) continue;
    const message = messagePayloadSchema.safeParse(response.data.payload);
    if (!message.success) {
      const payloadIdentity = z.object({
        type: z.string().optional(),
        role: z.string().optional(),
      }).safeParse(response.data.payload);
      if (
        payloadIdentity.success
        && payloadIdentity.data.type === 'message'
        && ['user', 'assistant'].includes(payloadIdentity.data.role ?? '')
      ) complete = false;
      continue;
    }
    for (const [blockIndex, block] of message.data.content.entries()) {
      const content = textFromBlock(block);
      if (!content || isSynthetic(content)) continue;
      events.push({
        providerEventId: `${message.data.id ?? nativeSessionId}:${record.line}#${blockIndex}`,
        role: message.data.role,
        timestamp: response.data.timestamp ?? null,
        summary: compact(content),
      });
    }
  }

  const timestamps = parsed.records
    .map((record) => record.value.timestamp)
    .filter((value): value is string => typeof value === 'string');
  const firstUser = events.find((event) => event.role === 'user')?.summary;
  return {
    provider: 'codex',
    nativeSessionId,
    sourceDigest: `sha256:${createHash('sha256').update(source).digest('hex')}`,
    sourceRef: sourceRef(filePath),
    title: compact(firstUser ?? `Codex session ${nativeSessionId.slice(0, 8)}`, 180),
    startedAt: metadata?.timestamp ?? timestamps[0] ?? null,
    updatedAt: timestamps.at(-1) ?? metadata?.timestamp ?? null,
    complete,
    events,
  };
}
