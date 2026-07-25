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
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createReportingEngine,
  reportingSnapshotSchema,
  sessionProviderSchema,
  verifyPublishedProjectionEnvelope,
  type RecordReceiptInput,
  type ReportingResult,
  type ReportingSnapshot,
  type SessionProvider,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { reportGenerationPolicy } from './generation-policy.ts';
import { renderStandaloneReport } from './html-renderer.ts';
import { migrateReportingSnapshot } from './migrate-reporting-snapshot.ts';
import {
  createPublishedEnvelope,
  createPublishedProjection,
  verifyPublishedEnvelope,
} from './publish-report.ts';
import {
  assertFinalEvidenceState,
  collectRepositoryReceipts,
  resolveRepositoryEvidenceHead,
} from './repository-evidence.ts';
import { loadAgentWorkBrief } from './agent-work-brief.ts';
import { parseSessionFile } from './session-source.ts';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_STATE = join(REPO_ROOT, '.novakai-reports/reporting-state.json');
const DEFAULT_PUBLIC = join(REPO_ROOT, 'public/reports/accepted-report.json');
const DEFAULT_HTML_DIRECTORY = join(REPO_ROOT, 'docs/visual-reporting/reports');

interface Args {
  verb: 'generate' | 'show' | 'help';
  session?: string;
  provider: SessionProvider;
  state: string;
  publicEnvelope: string;
  htmlDirectory: string;
  base: string;
  evidenceRepo: string;
  evidenceHead?: string;
  checkScripts: string[];
  brief?: string;
  final: boolean;
  complete: boolean;
  report?: string;
}

function parseArgs(argv: string[]): Args {
  const verb = argv[0] === 'generate' || argv[0] === 'show' ? argv[0] : 'help';
  const args: Args = {
    verb,
    provider: 'codex',
    state: DEFAULT_STATE,
    publicEnvelope: DEFAULT_PUBLIC,
    htmlDirectory: DEFAULT_HTML_DIRECTORY,
    base: '31792d15f564a67729535ca275dc56826a85750b',
    evidenceRepo: REPO_ROOT,
    checkScripts: [],
    final: false,
    complete: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--session') args.session = resolve(argv[(index += 1)]);
    else if (value === '--provider') {
      args.provider = sessionProviderSchema.parse(argv[(index += 1)]);
    }
    else if (value === '--state') args.state = resolve(argv[(index += 1)]);
    else if (value === '--public') args.publicEnvelope = resolve(argv[(index += 1)]);
    else if (value === '--html-directory') args.htmlDirectory = resolve(argv[(index += 1)]);
    else if (value === '--base') args.base = argv[(index += 1)];
    else if (value === '--evidence-repo') args.evidenceRepo = resolve(argv[(index += 1)]);
    else if (value === '--evidence-head') args.evidenceHead = argv[(index += 1)];
    else if (value === '--check-script') {
      const script = argv[(index += 1)];
      if (!/^[A-Za-z0-9:_-]+$/.test(script)) {
        throw new Error(`Invalid npm check script: ${script}`);
      }
      args.checkScripts.push(script);
    }
    else if (value === '--brief') args.brief = resolve(argv[(index += 1)]);
    else if (value === '--report') args.report = argv[(index += 1)];
    else if (value === '--final') args.final = true;
    else if (value === '--complete') args.complete = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (args.checkScripts.length === 0) args.checkScripts.push('check');
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
  const input = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return reportingSnapshotSchema.parse(migrateReportingSnapshot(input));
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalJsonValue(entry)]),
    );
  }
  return value;
}

function writeSnapshotCas(path: string, snapshot: ReportingSnapshot, expectedRevision: number): void {
  const currentRevision = existsSync(path) ? loadSnapshot(path).revision : 0;
  if (currentRevision !== expectedRevision) {
    throw new Error(
      `Reporting state changed concurrently (expected revision ${expectedRevision}, found ${currentRevision}).`,
    );
  }
  writeAtomic(path, `${JSON.stringify(canonicalJsonValue(snapshot), null, 2)}\n`);
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

function executeCheckProof(
  repositoryRoot: string,
  sessionId: RecordReceiptInput['sessionId'],
  repositoryReceiptsDigest: string,
  scripts: readonly string[],
): RecordReceiptInput {
  const executedAt = new Date().toISOString();
  const command = scripts.map((script) => `npm run ${script}`).join(' && ');
  const outputs: string[] = [];
  let exitCode = 0;
  for (const script of scripts) {
    const result = spawnSync('npm', ['run', script], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    outputs.push(`$ npm run ${script}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
    if ((result.status ?? 1) !== 0) {
      exitCode = result.status ?? 1;
      break;
    }
  }
  const output = outputs.join('\n');
  return {
    sessionId,
    type: 'proof',
    title: exitCode === 0 ? 'Repository acceptance suite passed' : 'Repository acceptance suite failed',
    summary: `The local ${command} command executed and exited with code ${exitCode}.`,
    occurredAt: executedAt,
    evidence: [
      {
        kind: 'test',
        label: command,
        uri: 'command:npm-run-check',
        detail: digest(output),
      },
      {
        kind: 'commit',
        label: `Repository receipt set ${repositoryReceiptsDigest}`,
        uri: `digest:${repositoryReceiptsDigest}`,
      },
    ],
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
  if (args.final && !args.evidenceHead) {
    throw new Error('Final verified generation requires an explicit --evidence-head commit.');
  }
  if (args.provider !== 'codex' && !args.session) {
    throw new Error(`${args.provider} generation requires an explicit --session path.`);
  }
  const evidenceHead = resolveRepositoryEvidenceHead(args.evidenceRepo, args.evidenceHead ?? 'HEAD');
  if (args.final) assertFinalEvidenceState(args.evidenceRepo, evidenceHead.commit);
  withStateLock(args.state, () => {
    const initialSnapshot = loadSnapshot(args.state);
    const reporting = createReportingEngine({ initialSnapshot });
    const sessionInput = parseSessionFile(
      args.provider,
      args.session ?? defaultSessionPath(),
      { confirmComplete: args.complete },
    );
    const session = valueOrThrow(reporting.importSession(sessionInput));
    const agentBrief = args.brief ? loadAgentWorkBrief(args.brief, session) : undefined;
    const receipts = collectRepositoryReceipts({
      repoRoot: args.evidenceRepo,
      baseRef: args.base,
      evidenceHeadRef: evidenceHead.commit,
      sessionId: session.id,
      includeNarrativeReceipts: agentBrief === undefined,
    });
    const evidenceReceipts = [...receipts, ...(agentBrief?.receipts ?? [])].map((receipt) =>
      valueOrThrow(reporting.recordReceipt(receipt)));
    const evidenceReceiptsDigest = digest(JSON.stringify(
      evidenceReceipts.map((receipt) => receipt.id).sort(),
    ));
    if (args.final) {
      const proofCommand = args.checkScripts
        .map((script) => `npm run ${script}`)
        .join(' && ');
      const reusableProof = reporting.snapshot().receipts.find((receipt) =>
        receipt.sessionId === session.id
        && receipt.sourceDigest === session.sourceDigest
        && receipt.type === 'proof'
        && receipt.proof?.command === proofCommand
        && receipt.proof.exitCode === 0
        && receipt.evidence.some((evidence) =>
          evidence.uri === `digest:${evidenceReceiptsDigest}`));
      const proof = reusableProof
        ?? valueOrThrow(reporting.recordReceipt(
          executeCheckProof(
            args.evidenceRepo,
            session.id,
            evidenceReceiptsDigest,
            args.checkScripts,
          ),
        ));
      if (proof.proof?.exitCode !== 0) {
        throw new Error(`VerificationFailed: ${proof.proof?.command} exited ${proof.proof?.exitCode}.`);
      }
    }
    const draft = valueOrThrow(reporting.compileReport({
      sessionId: session.id,
      ...(agentBrief?.policy ?? reportGenerationPolicy(args.final)),
    }));
    const accepted = valueOrThrow(reporting.acceptReport({
      reportRevisionId: draft.id,
      expectedSourceDigest: draft.sourceDigest,
      expectedReceiptsDigest: draft.receiptsDigest,
    }));

    const authoritativeSnapshot = reporting.snapshot();
    const publicProjection = createPublishedProjection(accepted, authoritativeSnapshot.receipts);
    const htmlName = `${accepted.id.replace(':', '-')}.html`;
    const htmlPath = join(args.htmlDirectory, htmlName);
    const htmlRelative = relative(REPO_ROOT, htmlPath);
    const reportHtmlPath = `docs/visual-reporting/reports/${htmlName}`;
    const html = renderStandaloneReport(publicProjection);
    const envelope = createPublishedEnvelope(accepted, authoritativeSnapshot.receipts, {
      path: reportHtmlPath,
      content: html,
    }, evidenceHead);
    writeImmutable(htmlPath, html);
    writeSnapshotCas(args.state, authoritativeSnapshot, initialSnapshot.revision);
    writeAtomic(args.publicEnvelope, `${JSON.stringify(envelope, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      reportRevisionId: accepted.id,
      sourceDigest: accepted.sourceDigest,
      receiptsDigest: accepted.receiptsDigest,
      publicationDigest: envelope.publicationDigest,
      evidenceHead: envelope.evidenceHead,
      evidenceRepository: basename(args.evidenceRepo),
      publicEnvelope: relative(REPO_ROOT, args.publicEnvelope),
      html: htmlRelative,
      final: args.final,
    }, null, 2)}\n`);
  });
}

function show(args: Args): void {
  const input = JSON.parse(readFileSync(args.publicEnvelope, 'utf8')) as unknown;
  const shaped = verifyPublishedProjectionEnvelope(input);
  const envelope = verifyPublishedEnvelope(
    shaped,
    readFileSync(join(args.htmlDirectory, basename(shaped.html.path)), 'utf8'),
  );
  const selectedRevision = args.report ?? envelope.reportRevisionId;
  if (selectedRevision !== envelope.reportRevisionId) {
    throw new Error(`Published revision ${selectedRevision} is not available in the selected envelope.`);
  }
  process.stdout.write(`${JSON.stringify({
    reportRevisionId: envelope.reportRevisionId,
    sourceDigest: envelope.sourceDigest,
    receiptsDigest: envelope.receiptsDigest,
    publicProjectionDigest: envelope.publicProjectionDigest,
    evidenceHead: envelope.evidenceHead,
    outcome: envelope.projection.outcome,
    counts: envelope.projection.stats,
    html: envelope.html.path,
  }, null, 2)}\n`);
}

function help(): void {
  process.stdout.write(`report-session — compile one agent session into a local accepted report

Usage
  node tools/report-session/cli.ts generate [--provider codex|claude|kimi] [--session file]
  node tools/report-session/cli.ts generate --final --provider claude --session file --complete --evidence-repo path --evidence-head commit
  node tools/report-session/cli.ts show [--report report:<sha256>]

Options
  --provider <name>        codex, claude, or kimi (defaults to codex)
  --session <path>         Provider-native JSONL source; Codex discovery is preview-only
  --complete               Explicitly confirm the selected session is terminal
  --brief <path>           Validated agent-authored claims bound to this session
  --final                  Execute npm run check and require completion policy
  --state <path>           Private authority path (defaults outside public/)
  --public <path>          Runtime-validated public accepted-report envelope
  --html-directory <path>  Immutable HTML revision output directory
  --base <ref>             Git base used by the evidence adapter
  --evidence-repo <path>   Repository that owns the session's file and commit proof
  --evidence-head <commit> Immutable committed code/tree inspected by the report
  --check-script <name>    npm script used as executed proof; repeat for multiple gates
  --report <id>            Show this exact accepted revision

Acceptance is a local operator decision. It does not claim an authenticated actor
or provide multi-user authorization.

Provenance convention:
  evidence commit    = the named committed code/tree inspected by the report
  publication commit = a following docs/artifact-only commit, necessarily excluded
                       from its own evidence
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
