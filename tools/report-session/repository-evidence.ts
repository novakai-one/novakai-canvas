import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type {
  EvidenceRef,
  ModuleRef,
  RecordReceiptInput,
  WorkSessionId,
} from '../../src/capabilities/work-session-reporting/index.ts';

interface EvidenceOptions {
  repoRoot: string;
  baseRef: string;
  sessionId: WorkSessionId;
}

interface Area {
  key: string;
  module: ModuleRef;
  relatedModules: ModuleRef[];
  matches(path: string): boolean;
}

const reportingInterface: ModuleRef = {
  id: 'reporting.contract',
  label: 'Reporting public contract',
  role: 'interface',
};
const reportingCore: ModuleRef = {
  id: 'reporting.core',
  label: 'Reporting core',
  role: 'module',
};
const sourceAdapter: ModuleRef = {
  id: 'adapter.codex',
  label: 'Codex session adapter',
  role: 'adapter',
};
const reportProjection: ModuleRef = {
  id: 'projection.report',
  label: 'Visual report projection',
  role: 'projection',
};

const areas: Area[] = [
  {
    key: 'contract',
    module: reportingInterface,
    relatedModules: [reportingCore],
    matches: (path) => path.includes('work-session-reporting/contract')
      || path.endsWith('work-session-reporting/index.ts'),
  },
  {
    key: 'core',
    module: reportingCore,
    relatedModules: [reportingInterface, reportProjection],
    matches: (path) => path.includes('work-session-reporting/core/')
      || path.endsWith('work-session-reporting/reporting-engine.test.ts'),
  },
  {
    key: 'adapter',
    module: sourceAdapter,
    relatedModules: [reportingInterface],
    matches: (path) => path.startsWith('tools/report-session/'),
  },
  {
    key: 'projection',
    module: reportProjection,
    relatedModules: [],
    matches: (path) => path.startsWith('public/reports/')
      || path.endsWith('POC-Work-Session-Report.html'),
  },
];

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function changedFiles(repoRoot: string, baseRef: string): string[] {
  const committed = git(repoRoot, ['diff', '--name-only', `${baseRef}..HEAD`]).split('\n');
  const working = git(repoRoot, ['diff', '--name-only', baseRef]).split('\n');
  const untracked = git(repoRoot, ['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...new Set([...committed, ...working, ...untracked].filter(Boolean))]
    .filter((path) => path !== 'public/reports/accepted-report.json'
      && path !== '.superpowers/sdd/Novakai-Visual-Reporting-Handover.html/task-1-fix2-report.md'
      && !/^docs\/visual-reporting\/reports\/report-[0-9a-f]{64}\.html$/.test(path))
    .sort();
}

function currentContentDigest(repoRoot: string, path: string): string {
  const absolutePath = join(repoRoot, path);
  try {
    const metadata = lstatSync(absolutePath);
    if (metadata.isSymbolicLink()) return sha256(`symlink:${readlinkSync(absolutePath)}`);
    if (metadata.isFile()) return sha256(readFileSync(absolutePath));
    return sha256(`non-file:${metadata.mode}`);
  } catch {
    return sha256('deleted');
  }
}

function repositoryIdentity(
  repoRoot: string,
  baseRef: string,
  files: readonly string[],
): EvidenceRef[] {
  const baseCommit = git(repoRoot, ['rev-parse', `${baseRef}^{commit}`]);
  const baseTree = git(repoRoot, ['rev-parse', `${baseCommit}^{tree}`]);
  const headCommit = git(repoRoot, ['rev-parse', 'HEAD^{commit}']);
  const headTree = git(repoRoot, ['rev-parse', `${headCommit}^{tree}`]);
  const patchDigest = files.length === 0
    ? sha256('')
    : sha256(execFileSync('git', [
        'diff',
        '--binary',
        '--full-index',
        '--no-ext-diff',
        baseCommit,
        '--',
        ...files,
      ], { cwd: repoRoot }));
  const contentDigest = sha256(JSON.stringify({
    patchDigest,
    files: files.map((path) => ({
      path,
      digest: currentContentDigest(repoRoot, path),
    })),
  }));
  return [
    { kind: 'commit', label: `Repository base commit ${baseCommit}`, uri: `git:${baseCommit}` },
    { kind: 'commit', label: `Repository base tree ${baseTree}`, uri: `git-tree:${baseTree}` },
    { kind: 'commit', label: `Repository HEAD commit ${headCommit}`, uri: `git:${headCommit}` },
    { kind: 'commit', label: `Repository HEAD tree ${headTree}`, uri: `git-tree:${headTree}` },
    {
      kind: 'commit',
      label: `Repository content digest ${contentDigest}`,
      uri: `digest:${contentDigest}`,
      detail: `Canonical patch digest ${patchDigest}`,
    },
  ];
}

function evidenceUri(path: string): string {
  return `repo:${path}`;
}

function changeReceipt(
  area: Area,
  files: string[],
  sessionId: WorkSessionId,
  identityEvidence: readonly EvidenceRef[],
): RecordReceiptInput {
  return {
    sessionId,
    type: 'change',
    title: `Build ${area.module.label}`,
    summary: `${files.length} changed file${files.length === 1 ? '' : 's'} establish ${area.module.label.toLowerCase()}.`,
    occurredAt: null,
    module: area.module,
    relatedModules: area.relatedModules,
    evidence: [
      ...files.slice(0, 12).map((path) => ({
        kind: 'file' as const,
        label: path,
        uri: evidenceUri(path),
      })),
      ...identityEvidence,
    ],
    tags: ['poc', area.key],
  };
}

/** Turns the actual git change set and accepted architecture choices into structured receipts. */
export function collectRepositoryReceipts(options: EvidenceOptions): RecordReceiptInput[] {
  const files = changedFiles(options.repoRoot, options.baseRef);
  const identityEvidence = repositoryIdentity(options.repoRoot, options.baseRef, files);
  const receipts = areas.flatMap((area) => {
    const matching = files.filter(area.matches);
    return matching.length > 0
      ? [changeReceipt(area, matching, options.sessionId, identityEvidence)]
      : [];
  });
  receipts.push(
    {
      sessionId: options.sessionId,
      type: 'decision',
      title: 'Keep one reporting authority',
      summary: 'WorkSession, WorkReceipt, ReportDraft, and AcceptedReport remain owned by one host-neutral capability.',
      occurredAt: null,
      evidence: [
        {
          kind: 'file',
          label: 'Reporting contract',
          uri: evidenceUri('src/capabilities/work-session-reporting/contract.ts'),
        },
        ...identityEvidence,
      ],
      relatedModules: [],
      tags: ['authority', 'elite-gate'],
    },
    {
      sessionId: options.sessionId,
      type: 'decision',
      title: 'Keep renderers disposable',
      summary: 'Standalone HTML consumes a derived public projection and cannot mutate report truth.',
      occurredAt: null,
      evidence: [
        {
          kind: 'file',
          label: 'Visual implementation handover',
          uri: evidenceUri('docs/visual-reporting/Novakai-Visual-Reporting-Handover.html'),
        },
        ...identityEvidence,
      ],
      relatedModules: [],
      tags: ['projection', 'standalone-host'],
    },
    {
      sessionId: options.sessionId,
      type: 'artifact',
      title: 'Visual implementation handover',
      summary: 'The visual architecture, assumptions, fallbacks, AI instructions, and delivery gates live with the isolated worktree.',
      occurredAt: null,
      evidence: [
        {
          kind: 'artifact',
          label: 'Open visual handover',
          uri: evidenceUri('docs/visual-reporting/Novakai-Visual-Reporting-Handover.html'),
        },
        ...identityEvidence,
      ],
      relatedModules: [],
      tags: ['handover'],
    },
  );
  return receipts;
}
