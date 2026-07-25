import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClaudeSessionFile } from './claude-session-source.ts';
import { parseKimiSessionFile } from './kimi-session-source.ts';
import { parseSessionFile } from './session-source.ts';

const fixtureRoot = join(import.meta.dirname, 'fixtures');

describe('provider session source adapters', () => {
  it('normalizes Claude messages without publishing thinking or tool results', () => {
    const parsed = parseClaudeSessionFile(join(fixtureRoot, 'claude-session.jsonl'), {
      confirmComplete: true,
    });

    expect(parsed).toMatchObject({
      provider: 'claude',
      nativeSessionId: '44444444-4444-4444-8444-444444444444',
      title: 'Build a provider-neutral report',
      complete: true,
      warnings: [],
    });
    expect(parsed.events.map((event) => [event.role, event.summary])).toEqual([
      ['user', 'Build the Claude source adapter.'],
      ['assistant', 'The Claude source adapter is complete.'],
    ]);
    expect(parsed.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(parsed.sourceRef).not.toContain('/Users/');
  });

  it('normalizes Kimi prompts and answer parts without duplicating context messages', () => {
    const parsed = parseKimiSessionFile(join(fixtureRoot, 'kimi-session.jsonl'), {
      confirmComplete: true,
    });

    expect(parsed).toMatchObject({
      provider: 'kimi',
      nativeSessionId: 'kimi-session',
      complete: true,
      warnings: [],
    });
    expect(parsed.events.map((event) => [event.role, event.summary])).toEqual([
      ['user', 'Build the Kimi source adapter.'],
      ['assistant', 'The Kimi source adapter is complete.'],
    ]);
    expect(parsed.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(parsed.sourceRef).not.toContain('/Users/');
  });

  it('selects each adapter explicitly and fails closed on unknown provider content', () => {
    expect(parseSessionFile(
      'claude',
      join(fixtureRoot, 'claude-session.jsonl'),
    ).provider).toBe('claude');

    const directory = mkdtempSync(join(tmpdir(), 'kimi-source-test-'));
    const path = join(directory, 'wire.jsonl');
    writeFileSync(
      path,
      `${readFileSync(join(fixtureRoot, 'kimi-session.jsonl'), 'utf8')}`
      + '{"type":"future.kimi.record","payload":{"text":"must not disappear"}}\n',
      'utf8',
    );
    expect(parseKimiSessionFile(path).warnings).toContainEqual({
      code: 'UnsupportedContent',
      line: 8,
      message: 'Unsupported Kimi wire record type future.kimi.record.',
    });
  });
});
