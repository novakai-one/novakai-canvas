import type {
  ImportSessionInput,
  SessionProvider,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { parseClaudeSessionFile } from './claude-session-source.ts';
import { parseCodexSessionFile } from './codex-session-source.ts';
import { parseKimiSessionFile } from './kimi-session-source.ts';
import type { ParseSessionOptions } from './session-source-shared.ts';

type SessionSourceParser = (
  filePath: string,
  options?: ParseSessionOptions,
) => ImportSessionInput;

const sessionSourceParsers: Record<SessionProvider, SessionSourceParser> = {
  claude: parseClaudeSessionFile,
  codex: parseCodexSessionFile,
  kimi: parseKimiSessionFile,
};

/** Selects one provider adapter at the CLI composition root. */
export function parseSessionFile(
  provider: SessionProvider,
  filePath: string,
  options: ParseSessionOptions = {},
): ImportSessionInput {
  return sessionSourceParsers[provider](filePath, options);
}
