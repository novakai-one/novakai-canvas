import type {
  CompileReportInput,
  EvidenceRef,
  ReportEdge,
  ReportNode,
  ReportProjection,
  ReportRevisionId,
  WorkReceipt,
  WorkSession,
} from '../contract.ts';
import { stableHash } from './stable-value.ts';

function count(receipts: readonly WorkReceipt[], type: WorkReceipt['type']): number {
  return receipts.filter((receipt) => receipt.type === type).length;
}

function uniqueEvidence(receipts: readonly WorkReceipt[]): EvidenceRef[] {
  const byUri = new Map<string, EvidenceRef>();
  for (const receipt of receipts) {
    for (const evidence of receipt.evidence) {
      byUri.set(`${evidence.kind}:${evidence.uri}`, evidence);
    }
  }
  return [...byUri.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function changeMap(receipts: readonly WorkReceipt[]): {
  nodes: ReportNode[];
  edges: ReportEdge[];
} {
  const changed = receipts.filter((receipt) => receipt.type === 'change' && receipt.module);
  const modules = new Map<string, ReportNode>();
  const edges = new Map<string, ReportEdge>();
  for (const receipt of changed) {
    const module = receipt.module;
    if (!module) continue;
    const existing = modules.get(module.id);
    modules.set(module.id, {
      ...module,
      receiptCount: (existing?.receiptCount ?? 0) + 1,
    });
    for (const related of receipt.relatedModules) {
      if (!modules.has(related.id)) modules.set(related.id, { ...related, receiptCount: 0 });
      const id = `edge:${stableHash([module.id, related.id, receipt.title])}`;
      edges.set(id, {
        id,
        source: module.id,
        target: related.id,
        label: receipt.title,
        kind: module.role === 'adapter' ? 'calls' : 'changes',
      });
    }
  }
  return {
    nodes: [...modules.values()].sort((left, right) => left.label.localeCompare(right.label)),
    edges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function workflow(receipts: readonly WorkReceipt[], nextActions: CompileReportInput['nextActions']) {
  const steps = [
    {
      id: 'import-session',
      label: 'Import session',
      detail: 'Normalize provider events and bind the source digest.',
      status: 'done' as const,
    },
    {
      id: 'capture-receipts',
      label: 'Capture structured receipts',
      detail: `${receipts.length} change, decision, proof, blocker, and artifact receipts recorded.`,
      status: receipts.length > 0 ? 'done' as const : 'blocked' as const,
    },
    {
      id: 'compile-report',
      label: 'Compile visual report',
      detail: 'Build one deterministic projection from authoritative session evidence.',
      status: 'done' as const,
    },
    {
      id: 'immutable-revision',
      label: 'Seal immutable report revision',
      detail: 'Hash the projection bytes before local acceptance.',
      status: 'done' as const,
    },
  ];
  return [
    ...steps,
    ...nextActions.flatMap((action) => action.status === 'queued'
      ? []
      : [{
          id: action.id,
          label: action.label,
          detail: action.dependsOn.length > 0
            ? `Depends on ${action.dependsOn.join(', ')}.`
            : 'No remaining dependency.',
          status: action.status,
        }]),
  ];
}

/** Pure deterministic compilation of session truth into a disposable visual projection. */
export function compileProjection(
  session: WorkSession,
  receipts: readonly WorkReceipt[],
  input: CompileReportInput,
): ReportProjection {
  const receiptsDigest = `sha256:${stableHash(
    receipts.map((receipt) => ({ id: receipt.id, sourceDigest: receipt.sourceDigest })),
  )}`;
  const revisionId = `report:${stableHash({
    sessionId: session.id,
    sourceDigest: session.sourceDigest,
    receiptsDigest,
    outcome: input.outcome,
    nextActions: input.nextActions,
  })}` as ReportRevisionId;
  return {
    schemaVersion: 1,
    reportRevisionId: revisionId,
    sessionId: session.id,
    sourceDigest: session.sourceDigest,
    receiptsDigest,
    title: input.outcome.headline,
    source: {
      provider: session.provider,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      eventCount: session.events.length,
      complete: session.complete,
      warningCount: session.warnings.length,
    },
    outcome: input.outcome,
    stats: {
      changes: count(receipts, 'change'),
      decisions: count(receipts, 'decision'),
      proofs: count(receipts, 'proof'),
      blockers: count(receipts, 'blocker'),
      artifacts: count(receipts, 'artifact'),
    },
    changeMap: changeMap(receipts),
    workflow: workflow(receipts, input.nextActions),
    proofs: receipts.filter((receipt) => receipt.type === 'proof'),
    decisions: receipts.filter((receipt) => receipt.type === 'decision'),
    blockers: receipts.filter((receipt) => receipt.type === 'blocker'),
    artifacts: receipts.filter((receipt) => receipt.type === 'artifact'),
    nextActions: input.nextActions,
    evidence: uniqueEvidence(receipts),
  };
}
