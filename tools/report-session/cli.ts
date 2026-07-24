#!/usr/bin/env node

import { readdirSync, readFileSync, renameSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createReportingEngine,
  reportingSnapshotSchema,
  type ReportingResult,
} from '../../src/capabilities/work-session-reporting/index.ts';
import { parseCodexSessionFile } from './codex-session-source.ts';
import { renderStandaloneReport } from './html-renderer.ts';
import { collectRepositoryReceipts } from './repository-evidence.ts';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_STATE = join(REPO_ROOT, 'public/reports/poc-reporting-state.json');
const DEFAULT_HTML = join(REPO_ROOT, 'docs/visual-reporting/POC-Work-Session-Report.html');

interface Args {
  verb: 'generate' | 'show' | 'help';
  session?: string;
  state: string;
  html: string;
  base: string;
  verified: boolean;
}

function parseArgs(argv: string[]): Args {
  const verb = argv[0] === 'generate' || argv[0] === 'show' ? argv[0] : 'help';
  const args: Args = {
    verb,
    state: DEFAULT_STATE,
    html: DEFAULT_HTML,
    base: '31792d15f564a67729535ca275dc56826a85750b',
    verified: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--session') args.session = resolve(argv[(index += 1)]);
    else if (value === '--state') args.state = resolve(argv[(index += 1)]);
    else if (value === '--html') args.html = resolve(argv[(index += 1)]);
    else if (value === '--base') args.base = argv[(index += 1)];
    else if (value === '--verified') args.verified = true;
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
  if (!associated) throw new Error(`No Codex session associated with ${REPO_ROOT}`);
  return associated.path;
}

function valueOrThrow<T>(result: ReportingResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content, 'utf8');
  renameSync(temporary, path);
}

function generate(args: Args): void {
  const sessionInput = parseCodexSessionFile(args.session ?? defaultSessionPath());
  const reporting = createReportingEngine();
  const session = valueOrThrow(reporting.importSession(sessionInput));
  const receipts = collectRepositoryReceipts({
    repoRoot: REPO_ROOT,
    baseRef: args.base,
    sessionId: session.id,
    verified: args.verified,
  });
  for (const receipt of receipts) valueOrThrow(reporting.recordReceipt(receipt));
  const draft = valueOrThrow(reporting.compileReport({
    sessionId: session.id,
    outcome: {
      status: args.verified ? 'complete' : 'partial',
      headline: args.verified
        ? 'One session now becomes one accepted visual report.'
        : 'The visual reporting proof of concept is taking shape.',
      summary: args.verified
        ? 'A real Codex session, structured git evidence, one reporting authority, and two visual hosts now form one reproducible path.'
        : 'The authoritative core and evidence adapters are present; current-host and final verification are still in progress.',
    },
    nextActions: args.verified ? [] : [
      {
        id: 'connect-canvas-host',
        label: 'Connect the accepted projection to the Canvas report experience',
        status: 'next',
        dependsOn: ['reporting-core'],
      },
      {
        id: 'run-acceptance',
        label: 'Run current-host, second-host, failure-path, and visual verification',
        status: 'queued',
        dependsOn: ['connect-canvas-host'],
      },
    ],
  }));
  const accepted = valueOrThrow(reporting.acceptReport({
    reportRevisionId: draft.id,
    expectedSourceDigest: draft.sourceDigest,
  }));
  writeAtomic(args.state, `${JSON.stringify(reporting.snapshot(), null, 2)}\n`);
  writeAtomic(args.html, renderStandaloneReport(accepted.projection));
  process.stdout.write(`${JSON.stringify({
    sessionId: session.id,
    reportRevisionId: accepted.id,
    sourceDigest: accepted.sourceDigest,
    sourceRef: session.sourceRef,
    state: args.state,
    html: args.html,
    verified: args.verified,
  }, null, 2)}\n`);
}

function show(args: Args): void {
  const snapshot = reportingSnapshotSchema.parse(JSON.parse(readFileSync(args.state, 'utf8')) as unknown);
  const reporting = createReportingEngine({ initialSnapshot: snapshot });
  const report = reporting.listReports()[0];
  if (!report) throw new Error('No accepted reports in state file.');
  const projection = valueOrThrow(reporting.readProjection(report.sessionId));
  process.stdout.write(`${JSON.stringify({
    reportRevisionId: projection.reportRevisionId,
    sourceDigest: projection.sourceDigest,
    headline: projection.outcome.headline,
    stats: projection.stats,
  }, null, 2)}\n`);
}

function help(): void {
  process.stdout.write(`report-session — compile one real Codex session into two visual hosts

Usage
  node tools/report-session/cli.ts generate [--session file] [--verified]
  node tools/report-session/cli.ts show [--state file]

Options
  --session <path>  Codex JSONL source; defaults to latest associated session
  --state <path>    Accepted reporting snapshot output
  --html <path>     Standalone visual report output
  --base <ref>      Git base used by the evidence adapter
  --verified        Record that the repository acceptance suite passed first
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
