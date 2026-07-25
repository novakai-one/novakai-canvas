import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import type {
  SessionEvent,
  SessionProvider,
  SessionWarning,
} from '../../src/capabilities/work-session-reporting/index.ts';

export interface ParseSessionOptions {
  confirmComplete?: boolean;
}

export interface ParsedJsonLine {
  line: number;
  value: unknown;
}

export function readJsonLines(
  source: string,
): { records: ParsedJsonLine[]; warnings: SessionWarning[] } {
  const records: ParsedJsonLine[] = [];
  const warnings: SessionWarning[] = [];
  for (const [index, line] of source.split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      records.push({ line: index + 1, value: JSON.parse(line) as unknown });
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

export function compactText(content: string, limit = 900): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

export function sourceDigest(source: string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

export function portableSourceRef(provider: SessionProvider, filePath: string): string {
  const providerHomes: Record<SessionProvider, { marker: string; label: string }> = {
    codex: { marker: '/.codex/', label: '$CODEX_HOME' },
    claude: { marker: '/.claude/', label: '$CLAUDE_HOME' },
    kimi: { marker: '/.kimi-code/', label: '$KIMI_HOME' },
  };
  const home = providerHomes[provider];
  const normalized = filePath.replaceAll('\\', '/');
  const markerIndex = normalized.lastIndexOf(home.marker);
  return markerIndex >= 0
    ? `${home.label}/${normalized.slice(markerIndex + home.marker.length)}`
    : `${home.label}/${basename(filePath)}`;
}

export function isoTimestamp(value: string | number | undefined): string | null {
  if (value === undefined) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function assertUniqueEvents(
  events: readonly SessionEvent[],
  warnings: SessionWarning[],
): void {
  const identities = new Map<string, SessionEvent>();
  for (const event of events) {
    const existing = identities.get(event.providerEventId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      warnings.push({
        code: 'ConflictingEventId',
        line: null,
        message: `Provider event id ${event.providerEventId} identifies conflicting content.`,
      });
    }
    identities.set(event.providerEventId, event);
  }
}
