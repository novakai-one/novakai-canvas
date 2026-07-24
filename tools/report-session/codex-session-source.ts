import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { z } from 'zod';
import type {
  ImportSessionInput,
  SessionEvent,
  SessionWarning,
} from '../../src/capabilities/work-session-reporting/index.ts';

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

interface ParseOptions {
  confirmComplete?: boolean;
}

function parseLines(source: string): { records: ParsedLine[]; warnings: SessionWarning[] } {
  const records: ParsedLine[] = [];
  const warnings: SessionWarning[] = [];
  for (const [index, line] of source.split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      const parsed = genericRecordSchema.safeParse(JSON.parse(line) as unknown);
      if (parsed.success) records.push({ line: index + 1, value: parsed.data });
      else {
        warnings.push({
          code: 'MalformedLine',
          line: index + 1,
          message: 'The JSON record did not match the Codex envelope.',
        });
      }
    } catch {
      warnings.push({
        code: 'MalformedLine',
        line: index + 1,
        message: 'The line is not valid JSON.',
      });
    }
  }
  return { records, warnings };
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

function hasTerminalSignal(records: readonly ParsedLine[]): boolean {
  return records.some(({ value }) => {
    if (value.type === 'session_end') return true;
    const parsed = z.object({
      type: z.literal('event_msg'),
      payload: z.object({
        type: z.enum(['task_complete', 'turn_complete']),
      }).passthrough(),
    }).safeParse(value);
    return parsed.success;
  });
}

const ignoredResponseItemTypes = new Set([
  'function_call',
  'function_call_output',
  'custom_tool_call',
  'custom_tool_call_output',
  'computer_call',
  'computer_call_output',
  'reasoning',
  'web_search_call',
]);

const ignoredEventTypes = new Set([
  'task_started',
  'turn_started',
  'task_complete',
  'turn_complete',
  'token_count',
  'context_compacted',
]);

const ignoredTopLevelTypes = new Set(['turn_context', 'session_end']);

/** Parses one real Codex JSONL session into the reporting capability's public import contract. */
export function parseCodexSessionFile(
  filePath: string,
  options: ParseOptions = {},
): ImportSessionInput {
  const source = readFileSync(filePath, 'utf8');
  const parsed = parseLines(source);
  const metaRecord = parsed.records
    .map((record) => sessionMetaSchema.safeParse(record.value))
    .find((result) => result.success);
  const metadata = metaRecord?.success ? metaRecord.data.payload : undefined;
  const nativeSessionId = metadata?.id ?? metadata?.session_id ?? fallbackId(filePath);
  const events: SessionEvent[] = [];
  const warnings = [...parsed.warnings];
  if (metadata === undefined) {
    warnings.push({
      code: 'MissingMetadata',
      line: null,
      message: 'No Codex session metadata record was found.',
    });
  }

  for (const record of parsed.records) {
    if (record.value.type === 'session_meta') {
      if (!sessionMetaSchema.safeParse(record.value).success) {
        warnings.push({
          code: 'UnsupportedContent',
          line: record.line,
          message: 'A session metadata record could not be normalized.',
        });
      }
      continue;
    }
    if (ignoredTopLevelTypes.has(record.value.type)) continue;
    if (record.value.type === 'event_msg') {
      const event = z.object({
        payload: z.object({ type: z.string() }).passthrough(),
      }).safeParse(record.value);
      if (event.success && ignoredEventTypes.has(event.data.payload.type)) continue;
      warnings.push({
        code: 'UnsupportedContent',
        line: record.line,
        message: event.success
          ? `Unsupported event payload type ${event.data.payload.type}.`
          : 'An event record could not be normalized.',
      });
      continue;
    }
    if (record.value.type !== 'response_item') {
      warnings.push({
        code: 'UnsupportedContent',
        line: record.line,
        message: `Unsupported top-level record type ${record.value.type}.`,
      });
      continue;
    }

    const response = responseItemSchema.safeParse(record.value);
    if (!response.success) {
      warnings.push({
        code: 'UnsupportedContent',
        line: record.line,
        message: 'A response item record could not be normalized.',
      });
      continue;
    }
    const message = messagePayloadSchema.safeParse(response.data.payload);
    if (!message.success) {
      const payloadIdentity = z.object({ type: z.string() })
        .passthrough()
        .safeParse(response.data.payload);
      if (payloadIdentity.success && ignoredResponseItemTypes.has(payloadIdentity.data.type)) {
        continue;
      }
      warnings.push({
        code: 'UnsupportedContent',
        line: record.line,
        message: payloadIdentity.success
          ? `Unsupported response item payload type ${payloadIdentity.data.type}.`
          : 'A response item payload could not be normalized.',
      });
      continue;
    }
    for (const [blockIndex, block] of message.data.content.entries()) {
      const content = textFromBlock(block);
      if (!content) {
        if (block.type !== 'input_text' && block.type !== 'output_text' && block.type !== 'text') {
          warnings.push({
            code: 'UnsupportedContent',
            line: record.line,
            message: `Unsupported message content block ${block.type}.`,
          });
        }
        continue;
      }
      if (isSynthetic(content)) continue;
      events.push({
        providerEventId: message.data.id
          ? `${message.data.id}#${blockIndex}`
          : `${nativeSessionId}:${record.line}#${blockIndex}`,
        role: message.data.role,
        timestamp: response.data.timestamp ?? null,
        summary: compact(content),
      });
    }
  }

  const eventIdentities = new Map<string, SessionEvent>();
  for (const event of events) {
    const existing = eventIdentities.get(event.providerEventId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      warnings.push({
        code: 'ConflictingEventId',
        line: null,
        message: `Provider event id ${event.providerEventId} identifies conflicting content.`,
      });
    }
    eventIdentities.set(event.providerEventId, event);
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
    complete: options.confirmComplete === true || hasTerminalSignal(parsed.records),
    warnings,
    events,
  };
}
