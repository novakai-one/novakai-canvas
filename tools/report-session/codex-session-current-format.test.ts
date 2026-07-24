import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCodexSessionFile } from './codex-session-source.ts';

const NOW = '2026-07-25T00:00:00.000Z';

function writeSession(records: unknown[]): string {
  const directory = mkdtempSync(join(tmpdir(), 'codex-current-format-'));
  const path = join(directory, 'session.jsonl');
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  return path;
}

describe('current Codex session format compatibility', () => {
  it('explicitly ignores known UI, tool, collaboration, and instruction mirrors', () => {
    const records = [
      {
        timestamp: NOW,
        type: 'session_meta',
        payload: { id: 'current-format-session', timestamp: NOW },
      },
      {
        timestamp: NOW,
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: 'private runtime instructions' }],
        },
      },
      ...['world_state', 'compacted', 'inter_agent_communication_metadata', 'turn_context']
        .map((type) => ({ timestamp: NOW, type, payload: {} })),
      ...[
        'user_message',
        'agent_message',
        'sub_agent_activity',
        'patch_apply_end',
        'thread_settings_applied',
        'web_search_end',
        'mcp_tool_call_end',
        'turn_aborted',
        'thread_goal_updated',
      ].map((type) => ({ timestamp: NOW, type: 'event_msg', payload: { type } })),
      ...['tool_search_call', 'tool_search_output', 'agent_message']
        .map((type) => ({ timestamp: NOW, type: 'response_item', payload: { type } })),
      {
        timestamp: NOW,
        type: 'response_item',
        payload: {
          type: 'message',
          id: 'user-message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Build the report from this actual session.' }],
        },
      },
      {
        timestamp: NOW,
        type: 'response_item',
        payload: {
          type: 'message',
          id: 'assistant-message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'The verified report is ready.' }],
        },
      },
    ];

    const parsed = parseCodexSessionFile(writeSession(records), { confirmComplete: true });

    expect(parsed.warnings).toEqual([]);
    expect(parsed.events.map((event) => event.summary)).toEqual([
      'Build the report from this actual session.',
      'The verified report is ready.',
    ]);
  });

  it('continues to reject genuinely unknown record, event, payload, and message-role types', () => {
    const path = writeSession([
      {
        timestamp: NOW,
        type: 'session_meta',
        payload: { id: 'unknown-format-session', timestamp: NOW },
      },
      { timestamp: NOW, type: 'future_state', payload: {} },
      { timestamp: NOW, type: 'event_msg', payload: { type: 'future_event' } },
      { timestamp: NOW, type: 'response_item', payload: { type: 'future_payload' } },
      {
        timestamp: NOW,
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'future_role',
          content: [{ type: 'input_text', text: 'must not silently disappear' }],
        },
      },
    ]);

    expect(parseCodexSessionFile(path, { confirmComplete: true }).warnings).toEqual([
      expect.objectContaining({ message: 'Unsupported top-level record type future_state.' }),
      expect.objectContaining({ message: 'Unsupported event payload type future_event.' }),
      expect.objectContaining({ message: 'Unsupported response item payload type future_payload.' }),
      expect.objectContaining({ message: 'Unsupported response item payload type message.' }),
    ]);
  });
});
