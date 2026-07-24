import { execFileSync } from 'node:child_process';
import type {
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

const canvasHost: ModuleRef = {
  id: 'host.canvas',
  label: 'Novakai Canvas',
  role: 'caller',
};
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
    relatedModules: [reportingCore, canvasHost],
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
    key: 'host',
    module: canvasHost,
    relatedModules: [reportingInterface, reportProjection],
    matches: (path) => path.includes('work-session-report')
      && !path.includes('capabilities/work-session-reporting'),
  },
  {
    key: 'projection',
    module: reportProjection,
    relatedModules: [canvasHost],
    matches: (path) => path.startsWith('public/reports/')
      || path.endsWith('POC-Work-Session-Report.html'),
  },
];

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function changedFiles(repoRoot: string, baseRef: string): string[] {
  const committed = git(repoRoot, ['diff', '--name-only', `${baseRef}..HEAD`]).split('\n');
  const working = git(repoRoot, ['diff', '--name-only', baseRef]).split('\n');
  const untracked = git(repoRoot, ['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...new Set([...committed, ...working, ...untracked].filter(Boolean))].sort();
}

function evidenceUri(path: string): string {
  return `repo:${path}`;
}

function changeReceipt(
  area: Area,
  files: string[],
  sessionId: WorkSessionId,
): RecordReceiptInput {
  return {
    sessionId,
    type: 'change',
    title: `Build ${area.module.label}`,
    summary: `${files.length} changed file${files.length === 1 ? '' : 's'} establish ${area.module.label.toLowerCase()}.`,
    occurredAt: null,
    module: area.module,
    relatedModules: area.relatedModules,
    evidence: files.slice(0, 12).map((path) => ({
      kind: 'file',
      label: path,
      uri: evidenceUri(path),
    })),
    tags: ['poc', area.key],
  };
}

/** Turns the actual git change set and accepted architecture choices into structured receipts. */
export function collectRepositoryReceipts(options: EvidenceOptions): RecordReceiptInput[] {
  const files = changedFiles(options.repoRoot, options.baseRef);
  const receipts = areas.flatMap((area) => {
    const matching = files.filter(area.matches);
    return matching.length > 0 ? [changeReceipt(area, matching, options.sessionId)] : [];
  });
  receipts.push(
    {
      sessionId: options.sessionId,
      type: 'decision',
      title: 'Keep one reporting authority',
      summary: 'WorkSession, WorkReceipt, ReportDraft, and AcceptedReport remain owned by one host-neutral capability.',
      occurredAt: null,
      evidence: [{
        kind: 'file',
        label: 'Reporting contract',
        uri: evidenceUri('src/capabilities/work-session-reporting/contract.ts'),
      }],
      relatedModules: [],
      tags: ['authority', 'elite-gate'],
    },
    {
      sessionId: options.sessionId,
      type: 'decision',
      title: 'Keep renderers disposable',
      summary: 'Canvas and standalone HTML consume the same accepted report projection and cannot mutate report truth.',
      occurredAt: null,
      evidence: [{
        kind: 'file',
        label: 'Visual implementation handover',
        uri: evidenceUri('docs/visual-reporting/Novakai-Visual-Reporting-Handover.html'),
      }],
      relatedModules: [],
      tags: ['projection', 'second-host'],
    },
    {
      sessionId: options.sessionId,
      type: 'artifact',
      title: 'Visual implementation handover',
      summary: 'The visual architecture, assumptions, fallbacks, AI instructions, and delivery gates live with the isolated worktree.',
      occurredAt: null,
      evidence: [{
        kind: 'artifact',
        label: 'Open visual handover',
        uri: evidenceUri('docs/visual-reporting/Novakai-Visual-Reporting-Handover.html'),
      }],
      relatedModules: [],
      tags: ['handover'],
    },
  );
  return receipts;
}
