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

const textBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
const promptSchema = z.object({
  type: z.literal('turn.prompt'),
  time: z.number(),
  input: z.union([
    z.string(),
    z.array(z.object({ type: z.string() }).passthrough()),
  ]),
}).passthrough();
const contentPartSchema = z.object({
  type: z.literal('context.append_loop_event'),
  time: z.number(),
  event: z.object({
    type: z.literal('content.part'),
    uuid: z.string().optional(),
    stepUuid: z.string().optional(),
    part: z.object({ type: z.string() }).passthrough(),
  }).passthrough(),
}).passthrough();
const genericRecordSchema = z.object({ type: z.string() }).passthrough();

const ignoredTopLevelTypes = new Set([
  'config.update',
  'context.append_message',
  'llm.request',
  'llm.tools_snapshot',
  'metadata',
  'permission.set_mode',
  'tools.set_active_tools',
  'tools.update_store',
  'usage.record',
]);
const ignoredLoopEventTypes = new Set(['step.begin', 'step.end', 'tool.call', 'tool.result']);

function nativeSessionId(filePath: string): string {
  return filePath.replaceAll('\\', '/').match(/\/session_([^/]+)\//)?.[1]
    ?? basename(filePath, '.jsonl');
}

function promptTexts(input: z.infer<typeof promptSchema>['input']): string[] {
  if (typeof input === 'string') return [input];
  return input.flatMap((block) => {
    const text = textBlockSchema.safeParse(block);
    return text.success ? [text.data.text] : [];
  });
}

function sessionTitle(content: string, sessionId: string): string {
  const agent = content.match(/You are agent "([^"]+)"/)?.[1];
  return agent ? `${agent} work session` : `Kimi session ${sessionId.slice(0, 8)}`;
}

/** Parses one Kimi Code wire JSONL session into the reporting capability import contract. */
export function parseKimiSessionFile(
  filePath: string,
  options: ParseSessionOptions = {},
): ImportSessionInput {
  const source = readFileSync(filePath, 'utf8');
  const parsed = readJsonLines(source);
  const sessionId = nativeSessionId(filePath);
  const events: SessionEvent[] = [];

  for (const record of parsed.records) {
    const generic = genericRecordSchema.safeParse(record.value);
    if (!generic.success) {
      parsed.warnings.push({
        code: 'MalformedLine',
        line: record.line,
        message: 'The JSON record did not match the Kimi wire envelope.',
      });
      continue;
    }
    if (generic.data.type === 'turn.prompt') {
      const prompt = promptSchema.safeParse(record.value);
      if (!prompt.success) {
        parsed.warnings.push({
          code: 'UnsupportedContent',
          line: record.line,
          message: 'A Kimi prompt record could not be normalized.',
        });
        continue;
      }
      for (const [blockIndex, text] of promptTexts(prompt.data.input).entries()) {
        const summary = compactText(text);
        if (!summary) continue;
        events.push({
          providerEventId: `${sessionId}:prompt:${record.line}#${blockIndex}`,
          role: 'user',
          timestamp: isoTimestamp(prompt.data.time),
          summary,
        });
      }
      continue;
    }
    if (generic.data.type === 'context.append_loop_event') {
      const loopEvent = z.object({
        event: z.object({ type: z.string() }).passthrough(),
      }).safeParse(record.value);
      if (!loopEvent.success) {
        parsed.warnings.push({
          code: 'UnsupportedContent',
          line: record.line,
          message: 'A Kimi loop event could not be classified.',
        });
        continue;
      }
      if (ignoredLoopEventTypes.has(loopEvent.data.event.type)) continue;
      if (loopEvent.data.event.type !== 'content.part') {
        parsed.warnings.push({
          code: 'UnsupportedContent',
          line: record.line,
          message: `Unsupported Kimi loop event type ${loopEvent.data.event.type}.`,
        });
        continue;
      }
      const content = contentPartSchema.safeParse(record.value);
      if (!content.success) {
        parsed.warnings.push({
          code: 'UnsupportedContent',
          line: record.line,
          message: 'A Kimi content part could not be normalized.',
        });
        continue;
      }
      if (content.data.event.part.type === 'think') continue;
      const text = textBlockSchema.safeParse(content.data.event.part);
      if (!text.success) {
        parsed.warnings.push({
          code: 'UnsupportedContent',
          line: record.line,
          message: `Unsupported Kimi content part ${content.data.event.part.type}.`,
        });
        continue;
      }
      const summary = compactText(text.data.text);
      if (!summary) continue;
      events.push({
        providerEventId:
          content.data.event.uuid
          ?? content.data.event.stepUuid
          ?? `${sessionId}:content:${record.line}`,
        role: 'assistant',
        timestamp: isoTimestamp(content.data.time),
        summary,
      });
      continue;
    }
    if (!ignoredTopLevelTypes.has(generic.data.type)) {
      parsed.warnings.push({
        code: 'UnsupportedContent',
        line: record.line,
        message: `Unsupported Kimi wire record type ${generic.data.type}.`,
      });
    }
  }

  assertUniqueEvents(events, parsed.warnings);
  const timestamps = events
    .map((event) => event.timestamp)
    .filter((value): value is string => value !== null);
  const firstUser = events.find((event) => event.role === 'user')?.summary;
  return {
    provider: 'kimi',
    nativeSessionId: sessionId,
    sourceDigest: sourceDigest(source),
    sourceRef: portableSourceRef('kimi', filePath),
    title: sessionTitle(firstUser ?? '', sessionId),
    startedAt: timestamps[0] ?? null,
    updatedAt: timestamps.at(-1) ?? null,
    complete: options.confirmComplete === true,
    warnings: parsed.warnings,
    events,
  };
}
