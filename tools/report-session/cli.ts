#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createReportingEngine,
  publishedAcceptedReportEnvelopeSchema,
  reportingSnapshotSchema,
  type RecordReceiptInput,
  type ReportingResult,
  type ReportingSnapshot,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { parseCodexSessionFile } from './codex-session-source.ts';
import { renderStandaloneReport } from './html-renderer.ts';
import {
  createPublishedEnvelope,
  createPublishedProjection,
  verifyPublishedEnvelope,
} from './publish-report.ts';
import { collectRepositoryReceipts } from './repository-evidence.ts';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_STATE = join(REPO_ROOT, '.novakai-reports/reporting-state.json');
const DEFAULT_PUBLIC = join(REPO_ROOT, 'public/reports/accepted-report.json');
const DEFAULT_HTML_DIRECTORY = join(REPO_ROOT, 'docs/visual-reporting/reports');

interface Args {
  verb: 'generate' | 'show' | 'help';
  session?: string;
  state: string;
  publicEnvelope: string;
  htmlDirectory: string;
  base: string;
  final: boolean;
  complete: boolean;
  report?: string;
}

function parseArgs(argv: string[]): Args {
  const verb = argv[0] === 'generate' || argv[0] === 'show' ? argv[0] : 'help';
  const args: Args = {
    verb,
    state: DEFAULT_STATE,
    publicEnvelope: DEFAULT_PUBLIC,
    htmlDirectory: DEFAULT_HTML_DIRECTORY,
    base: '31792d15f564a67729535ca275dc56826a85750b',
    final: false,
    complete: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--session') args.session = resolve(argv[(index += 1)]);
    else if (value === '--state') args.state = resolve(argv[(index += 1)]);
    else if (value === '--public') args.publicEnvelope = resolve(argv[(index += 1)]);
    else if (value === '--html-directory') args.htmlDirectory = resolve(argv[(index += 1)]);
    else if (value === '--base') args.base = argv[(index += 1)];
    else if (value === '--report') args.report = argv[(index += 1)];
    else if (value === '--final') args.final = true;
    else if (value === '--complete') args.complete = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function jsonlFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...jsonlFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) result.push(path);
  }
  return result;
}

function defaultSessionPath(): string {
  const sessionsRoot = join(homedir(), '.codex/sessions');
  const candidates = jsonlFiles(sessionsRoot)
    .map((path) => ({ path, modifiedAt: statSync(path).mtimeMs }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  const associated = candidates.find(({ path }) => {
    const firstLine = readFileSync(path, 'utf8').split('\n', 1)[0];
    try {
      const record = JSON.parse(firstLine) as { type?: string; payload?: { cwd?: string } };
      const cwd = record.type === 'session_meta' ? record.payload?.cwd : undefined;
      return cwd !== undefined && (REPO_ROOT.startsWith(cwd) || cwd.startsWith(REPO_ROOT));
    } catch {
      return false;
    }
  });
  if (!associated) throw new Error(`No Codex session associated with the current repository.`);
  return associated.path;
}

function valueOrThrow<T>(result: ReportingResult<T>): T {
  if (!result.ok) {
    const detail = result.error.issues?.length ? ` (${result.error.issues.join('; ')})` : '';
    throw new Error(`${result.error.code}: ${result.error.message}${detail}`);
  }
  return result.value;
}

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content, 'utf8');
  renameSync(temporary, path);
}

function writeImmutable(path: string, content: string): void {
  if (existsSync(path)) {
    if (readFileSync(path, 'utf8') !== content) {
      throw new Error(`Immutable publication conflict at ${relative(REPO_ROOT, path)}.`);
    }
    return;
  }
  writeAtomic(path, content);
}

function loadSnapshot(path: string): ReportingSnapshot {
  if (!existsSync(path)) {
    return {
      schemaVersion: 1,
      revision: 0,
      sessions: [],
      receipts: [],
      drafts: [],
      acceptedReports: [],
    };
  }
  return reportingSnapshotSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

function writeSnapshotCas(path: string, snapshot: ReportingSnapshot, expectedRevision: number): void {
  const currentRevision = existsSync(path) ? loadSnapshot(path).revision : 0;
  if (currentRevision !== expectedRevision) {
    throw new Error(
      `Reporting state changed concurrently (expected revision ${expectedRevision}, found ${currentRevision}).`,
    );
  }
  writeAtomic(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}

function withStateLock<T>(statePath: string, action: () => T): T {
  mkdirSync(dirname(statePath), { recursive: true });
  const lockPath = `${statePath}.lock`;
  let lock: number;
  try {
    lock = openSync(lockPath, 'wx');
  } catch {
    throw new Error('Another report generation process holds the local state lock.');
  }
  try {
    return action();
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function boundedOutput(value: string): string {
  if (value.length <= 4_000) return value;
  return `${value.slice(0, 1_900)}\n… output redacted to 4,000 characters …\n${value.slice(-1_900)}`;
}

function executeCheckProof(sessionId: RecordReceiptInput['sessionId']): RecordReceiptInput {
  const executedAt = new Date().toISOString();
  const command = 'npm run check';
  const result = spawnSync('npm', ['run', 'check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const exitCode = result.status ?? 1;
  return {
    sessionId,
    type: 'proof',
    title: exitCode === 0 ? 'Repository acceptance suite passed' : 'Repository acceptance suite failed',
    summary: `The local ${command} command executed and exited with code ${exitCode}.`,
    occurredAt: executedAt,
    evidence: [{
      kind: 'test',
      label: command,
      uri: 'command:npm-run-check',
      detail: digest(output),
    }],
    relatedModules: [],
    tags: ['verification', 'executed-command'],
    proof: {
      command,
      exitCode,
      executedAt,
      outputDigest: digest(output),
      outputExcerpt: boundedOutput(output),
    },
  };
}

function generate(args: Args): void {
  if (args.final && !args.session) {
    throw new Error('Final verified generation requires an explicit --session path.');
  }
  if (args.final && !args.complete) {
    throw new Error('Final verified generation requires explicit --complete confirmation.');
  }
  withStateLock(args.state, () => {
    const initialSnapshot = loadSnapshot(args.state);
    const reporting = createReportingEngine({ initialSnapshot });
    const sessionInput = parseCodexSessionFile(
      args.session ?? defaultSessionPath(),
      { confirmComplete: args.complete },
    );
    const session = valueOrThrow(reporting.importSession(sessionInput));
    const receipts = collectRepositoryReceipts({
      repoRoot: REPO_ROOT,
      baseRef: args.base,
      sessionId: session.id,
    });
    for (const receipt of receipts) valueOrThrow(reporting.recordReceipt(receipt));
    if (args.final) {
      const proof = valueOrThrow(reporting.recordReceipt(executeCheckProof(session.id)));
      if (proof.proof?.exitCode !== 0) {
        throw new Error(`VerificationFailed: ${proof.proof?.command} exited ${proof.proof?.exitCode}.`);
      }
    }
    const draft = valueOrThrow(reporting.compileReport({
      sessionId: session.id,
      outcome: {
        status: args.final ? 'complete' : 'partial',
        headline: args.final
          ? 'One session now becomes one accepted visual report.'
          : 'The visual reporting proof of concept is taking shape.',
        summary: args.final
          ? 'A completed Codex session and executed repository proof now produce one immutable local report revision.'
          : 'This local preview is intentionally not a verified completion report.',
      },
      nextActions: args.final ? [] : [{
        id: 'run-final-generation',
        label: 'Generate with an explicit session, completion confirmation, and executed proof',
        status: 'next',
        dependsOn: [],
      }],
    }));
    const accepted = valueOrThrow(reporting.acceptReport({
      reportRevisionId: draft.id,
      expectedSourceDigest: draft.sourceDigest,
      expectedReceiptsDigest: draft.receiptsDigest,
    }));

    const publicProjection = createPublishedProjection(accepted);
    const htmlPath = join(args.htmlDirectory, `${accepted.id.replace(':', '-')}.html`);
    const htmlRelative = relative(REPO_ROOT, htmlPath);
    const html = renderStandaloneReport(publicProjection);
    const envelope = createPublishedEnvelope(accepted, {
      path: htmlRelative,
      content: html,
    });
    writeImmutable(htmlPath, html);
    writeSnapshotCas(args.state, reporting.snapshot(), initialSnapshot.revision);
    writeAtomic(args.publicEnvelope, `${JSON.stringify(envelope, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      reportRevisionId: accepted.id,
      sourceDigest: accepted.sourceDigest,
      receiptsDigest: accepted.receiptsDigest,
      publicationDigest: envelope.publicationDigest,
      publicEnvelope: relative(REPO_ROOT, args.publicEnvelope),
      html: htmlRelative,
      final: args.final,
    }, null, 2)}\n`);
  });
}

function show(args: Args): void {
  const input = JSON.parse(readFileSync(args.publicEnvelope, 'utf8')) as unknown;
  const shaped = publishedAcceptedReportEnvelopeSchema.parse(input);
  const envelope = verifyPublishedEnvelope(
    input,
    readFileSync(join(REPO_ROOT, shaped.html.path), 'utf8'),
  );
  const selectedRevision = args.report ?? envelope.reportRevisionId;
  if (selectedRevision !== envelope.reportRevisionId) {
    throw new Error(`Published revision ${selectedRevision} is not available in the selected envelope.`);
  }
  process.stdout.write(`${JSON.stringify({
    reportRevisionId: envelope.reportRevisionId,
    sourceDigest: envelope.sourceDigest,
    receiptsDigest: envelope.receiptsDigest,
    headline: envelope.projection.outcome.headline,
    stats: envelope.projection.stats,
    html: envelope.html.path,
  }, null, 2)}\n`);
}

function help(): void {
  process.stdout.write(`report-session — compile one Codex session into a local accepted report

Usage
  node tools/report-session/cli.ts generate [--session file] [--complete]
  node tools/report-session/cli.ts generate --final --session file --complete
  node tools/report-session/cli.ts show [--report report:<sha256>]

Options
  --session <path>         Codex JSONL source; discovery is preview-only
  --complete               Explicitly confirm the selected session is terminal
  --final                  Execute npm run check and require completion policy
  --state <path>           Private authority path (defaults outside public/)
  --public <path>          Runtime-validated public accepted-report envelope
  --html-directory <path>  Immutable HTML revision output directory
  --base <ref>             Git base used by the evidence adapter
  --report <id>            Show this exact accepted revision

Acceptance is a local operator decision. It does not claim an authenticated actor
or provide multi-user authorization.
`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.verb === 'generate') generate(args);
  else if (args.verb === 'show') show(args);
  else help();
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`report-session: ${message}\n`);
  process.exitCode = 1;
}
