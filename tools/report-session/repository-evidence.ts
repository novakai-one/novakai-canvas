import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type {
  EvidenceRef,
  ModuleRef,
  RecordReceiptInput,
  WorkSessionId,
} from '../../src/capabilities/work-session-reporting/index.ts';

interface EvidenceOptions {
  repoRoot: string;
  baseRef: string;
  evidenceHeadRef: string;
  sessionId: WorkSessionId;
  includeNarrativeReceipts?: boolean;
}

export interface RepositoryEvidenceHead {
  commit: string;
  tree: string;
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

export function isGeneratedOrAdministrativePath(path: string): boolean {
  return path === 'public/reports/accepted-report.json'
    || /^docs\/visual-reporting\/reports\/report-[0-9a-f]{64}\.html$/.test(path)
    || /^\.superpowers\/sdd\/Novakai-Visual-Reporting-Handover\.html\/task-1-fix(?:\d+)?-report\.md$/
      .test(path);
}

export function resolveRepositoryEvidenceHead(
  repoRoot: string,
  evidenceHeadRef: string,
): RepositoryEvidenceHead {
  const commit = git(repoRoot, ['rev-parse', `${evidenceHeadRef}^{commit}`]);
  return {
    commit,
    tree: git(repoRoot, ['rev-parse', `${commit}^{tree}`]),
  };
}

function changedFiles(repoRoot: string, baseCommit: string, evidenceHeadCommit: string): string[] {
  const committed = git(repoRoot, [
    'diff',
    '--name-only',
    `${baseCommit}..${evidenceHeadCommit}`,
  ]).split('\n');
  return [...new Set(committed.filter(Boolean))]
    .filter((path) => !isGeneratedOrAdministrativePath(path))
    .sort();
}

function workingChanges(repoRoot: string): string[] {
  const unstaged = git(repoRoot, ['diff', '--name-only']).split('\n');
  const staged = git(repoRoot, ['diff', '--cached', '--name-only']).split('\n');
  const untracked = git(repoRoot, ['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...new Set([...unstaged, ...staged, ...untracked].filter(Boolean))].sort();
}

/** Requires final generation to execute from the named code commit plus publication-only changes. */
export function assertFinalEvidenceState(repoRoot: string, evidenceHeadCommit: string): void {
  const currentCommit = git(repoRoot, ['rev-parse', 'HEAD^{commit}']);
  if (currentCommit !== evidenceHeadCommit) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', evidenceHeadCommit, currentCommit], {
        cwd: repoRoot,
        stdio: 'ignore',
      });
    } catch {
      throw new Error('The evidence head must be the current commit or its publication-only ancestor.');
    }
    const committedAfterEvidence = git(repoRoot, [
      'diff',
      '--name-only',
      `${evidenceHeadCommit}..${currentCommit}`,
    ]).split('\n').filter(Boolean);
    const sourceCommits = committedAfterEvidence.filter((path) => !isGeneratedOrAdministrativePath(path));
    if (sourceCommits.length > 0) {
      throw new Error(
        `Commits after the evidence head change source files: ${sourceCommits.join(', ')}.`,
      );
    }
  }
  const dirtySource = workingChanges(repoRoot)
    .filter((path) => !isGeneratedOrAdministrativePath(path));
  if (dirtySource.length > 0) {
    throw new Error(`Final generation requires clean evidence-source files: ${dirtySource.join(', ')}.`);
  }
}

function committedContentDigest(repoRoot: string, commit: string, path: string): string {
  try {
    const identity = git(repoRoot, ['ls-tree', commit, '--', path]);
    if (!identity) return sha256('deleted');
    const content = execFileSync('git', ['show', `${commit}:${path}`], { cwd: repoRoot });
    return sha256(Buffer.concat([Buffer.from(`${identity}\n`), content]));
  } catch {
    return sha256('deleted');
  }
}

function repositoryIdentity(
  repoRoot: string,
  baseCommit: string,
  evidenceHead: RepositoryEvidenceHead,
  files: readonly string[],
): EvidenceRef[] {
  const baseTree = git(repoRoot, ['rev-parse', `${baseCommit}^{tree}`]);
  const patchDigest = files.length === 0
    ? sha256('')
    : sha256(execFileSync('git', [
        'diff',
        '--binary',
        '--full-index',
        '--no-ext-diff',
        baseCommit,
        evidenceHead.commit,
        '--',
        ...files,
      ], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }));
  const contentDigest = sha256(JSON.stringify({
    patchDigest,
    files: files.map((path) => ({
      path,
      digest: committedContentDigest(repoRoot, evidenceHead.commit, path),
    })),
  }));
  return [
    { kind: 'commit', label: `Repository base commit ${baseCommit}`, uri: `git:${baseCommit}` },
    { kind: 'commit', label: `Repository base tree ${baseTree}`, uri: `git-tree:${baseTree}` },
    {
      kind: 'commit',
      label: `Repository evidence commit ${evidenceHead.commit}`,
      uri: `git:${evidenceHead.commit}`,
    },
    {
      kind: 'commit',
      label: `Repository evidence tree ${evidenceHead.tree}`,
      uri: `git-tree:${evidenceHead.tree}`,
    },
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
  const baseCommit = git(options.repoRoot, ['rev-parse', `${options.baseRef}^{commit}`]);
  const evidenceHead = resolveRepositoryEvidenceHead(options.repoRoot, options.evidenceHeadRef);
  const files = changedFiles(options.repoRoot, baseCommit, evidenceHead.commit);
  const identityEvidence = repositoryIdentity(options.repoRoot, baseCommit, evidenceHead, files);
  const receipts = areas.flatMap((area) => {
    const matching = files.filter(area.matches);
    return matching.length > 0
      ? [changeReceipt(area, matching, options.sessionId, identityEvidence)]
      : [];
  });
  if (options.includeNarrativeReceipts !== false) receipts.push(
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
