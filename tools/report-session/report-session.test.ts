import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createReportingEngine,
  type ReportProjection,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { parseCodexSessionFile } from './codex-session-source.ts';
import { renderStandaloneReport } from './html-renderer.ts';

const fixture = new URL('./fixtures/codex-session.jsonl', import.meta.url).pathname;

describe('report session adapters', () => {
  it('parses a real Codex JSONL shape through a runtime-validated seam', () => {
    const result = parseCodexSessionFile(fixture);
    expect(result).toMatchObject({
      provider: 'codex',
      nativeSessionId: '22222222-2222-4222-8222-222222222222',
      complete: true,
      title: 'Build a visual work-session report.',
    });
    expect(result.events.map((event) => event.providerEventId)).toEqual([
      'message-user:2#0',
      'message-assistant:3#0',
    ]);
    expect(result.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('marks malformed JSONL as incomplete rather than silently dropping it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'novakai-report-session-'));
    const path = join(directory, 'broken.jsonl');
    writeFileSync(path, `${readFileSync(fixture, 'utf8')}not-json\n`, 'utf8');
    expect(parseCodexSessionFile(path).complete).toBe(false);
  });

  it('renders a deterministic standalone projection with no runtime dependency', () => {
    const reporting = createReportingEngine({ now: () => '2026-07-25T00:00:00.000Z' });
    const imported = reporting.importSession(parseCodexSessionFile(fixture));
    if (!imported.ok) throw new Error(imported.error.message);
    const draft = reporting.compileReport({
      sessionId: imported.value.id,
      outcome: {
        status: 'complete',
        headline: '<One report & two hosts>',
        summary: 'The standalone renderer receives only a projection.',
      },
      nextActions: [],
    });
    if (!draft.ok) throw new Error(draft.error.message);
    const html = renderStandaloneReport(draft.value.projection as ReportProjection);
    expect(html).toContain('&lt;One report &amp; two hosts&gt;');
    expect(html).toContain(draft.value.id);
    expect(html).toContain(draft.value.sourceDigest);
    expect(html).not.toContain('<script');
    expect(renderStandaloneReport(draft.value.projection)).toBe(html);
  });
});
