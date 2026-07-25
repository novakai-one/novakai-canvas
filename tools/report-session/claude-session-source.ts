import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { z } from 'zod';
import type {
  ImportSessionInput,
  SessionEvent,
} from '../../src/capabilities/work-session-reporting/index.ts';
import {
  assertUniqueEvents,
  compactText,
  isoTimestamp,
  portableSourceRef,
  readJsonLines,
  sourceDigest,
  type ParseSessionOptions,
} from './session-source-shared.ts';

const contentBlockSchema = z.object({ type: z.string() }).passthrough();
const messageRecordSchema = z.object({
  type: z.enum(['user', 'assistant']),
  uuid: z.string().optional(),
  sessionId: z.string().optional(),
  session_id: z.string().optional(),
  timestamp: z.string().optional(),
  isSidechain: z.boolean().optional(),
  message: z.object({
    role: z.enum(['user', 'assistant']),
    content: z.union([z.string(), z.array(contentBlockSchema)]),
  }).passthrough(),
}).passthrough();
const titledRecordSchema = z.object({
  type: z.literal('ai-title'),
  aiTitle: z.string(),
  sessionId: z.string().optional(),
}).passthrough();
const genericRecordSchema = z.object({
  type: z.string(),
  sessionId: z.string().optional(),
  session_id: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

const ignoredTopLevelTypes = new Set([
  'ai-title',
  'attachment',
  'file-history-delta',
  'file-history-snapshot',
  'last-prompt',
  'mode',
  'permission-mode',
  'pr-link',
  'queue-operation',
  'system',
]);
const ignoredBlockTypes = new Set(['thinking', 'tool_result', 'tool_use']);

function fallbackId(filePath: string): string {
  return basename(filePath, '.jsonl');
}

function blockText(block: z.infer<typeof contentBlockSchema>): string | undefined {
  if (block.type !== 'text') return undefined;
  const parsed = z.object({ type: z.literal('text'), text: z.string() }).safeParse(block);
  return parsed.success ? parsed.data.text : undefined;
}

function missionTitle(content: string): string | undefined {
  const mission = content.match(/mission_([A-Za-z0-9-]+)/)?.[1];
  if (!mission) return undefined;
  const words = mission.replaceAll('-', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} — Claude session`;
}

/** Parses one Claude Code JSONL session into the reporting capability import contract. */
export function parseClaudeSessionFile(
  filePath: string,
  options: ParseSessionOptions = {},
): ImportSessionInput {
  const source = readFileSync(filePath, 'utf8');
  const parsed = readJsonLines(source);
  const records = parsed.records.flatMap(({ line, value }) => {
    const record = genericRecordSchema.safeParse(value);
    if (record.success) return [{ line, value: record.data }];
    parsed.warnings.push({
      code: 'MalformedLine',
      line,
      message: 'The JSON record did not match the Claude envelope.',
    });
    return [];
  });
  const nativeSessionId = records
    .map(({ value }) => value.sessionId ?? value.session_id)
    .find((value): value is string => typeof value === 'string')
    ?? fallbackId(filePath);
  const events: SessionEvent[] = [];
  let sourceTitle: string | undefined;

  for (const record of records) {
    const title = titledRecordSchema.safeParse(record.value);
    if (title.success) {
      sourceTitle = sourceTitle ?? compactText(title.data.aiTitle, 180);
      continue;
    }
    if (record.value.type !== 'user' && record.value.type !== 'assistant') {
      if (!ignoredTopLevelTypes.has(record.value.type)) {
        parsed.warnings.push({
          code: 'UnsupportedContent',
          line: record.line,
          message: `Unsupported Claude record type ${record.value.type}.`,
        });
      }
      continue;
    }
    const message = messageRecordSchema.safeParse(record.value);
    if (!message.success) {
      parsed.warnings.push({
        code: 'UnsupportedContent',
        line: record.line,
        message: 'A Claude message record could not be normalized.',
      });
      continue;
    }
    if (message.data.isSidechain === true) continue;
    const role = message.data.message.role;
    const content = message.data.message.content;
    const texts: string[] = [];
    if (typeof content === 'string') {
      texts.push(content);
    } else {
      for (const block of content) {
        const text = blockText(block);
        if (text !== undefined) texts.push(text);
        else if (!ignoredBlockTypes.has(block.type)) {
          parsed.warnings.push({
            code: 'UnsupportedContent',
            line: record.line,
            message: `Unsupported Claude message content block ${block.type}.`,
          });
        }
      }
    }
    for (const [blockIndex, text] of texts.entries()) {
      const summary = compactText(text);
      if (!summary) continue;
      if (role === 'user') sourceTitle = missionTitle(summary) ?? sourceTitle;
      events.push({
        providerEventId: `${message.data.uuid ?? `${nativeSessionId}:${record.line}`}#${blockIndex}`,
        role,
        timestamp: isoTimestamp(message.data.timestamp),
        summary,
      });
    }
  }

  assertUniqueEvents(events, parsed.warnings);
  const timestamps = events
    .map((event) => event.timestamp)
    .filter((value): value is string => value !== null);
  const firstUser = events.find((event) => event.role === 'user')?.summary;
  return {
    provider: 'claude',
    nativeSessionId,
    sourceDigest: sourceDigest(source),
    sourceRef: portableSourceRef('claude', filePath),
    title: sourceTitle ?? compactText(firstUser ?? `Claude session ${nativeSessionId.slice(0, 8)}`, 180),
    startedAt: timestamps[0] ?? null,
    updatedAt: timestamps.at(-1) ?? null,
    complete: options.confirmComplete === true,
    warnings: parsed.warnings,
    events,
  };
}
