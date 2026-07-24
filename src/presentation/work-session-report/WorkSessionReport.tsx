import { useEffect, useState } from 'react';
import type {
  PublishedReceipt,
  PublishedReportProjection,
} from '../../capabilities/work-session-reporting/index.ts';
import {
  hydratePublishedReport,
  projectionIsEmpty,
  reportReceipts,
  selectReceipt,
  type WorkSessionReportViewModel,
} from './report-model.ts';
import './work-session-report.css';

type ReportScreenState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'empty'; report: WorkSessionReportViewModel }
  | { status: 'ready'; report: WorkSessionReportViewModel };

function compactIdentity(value: string): string {
  const [kind, digest] = value.split(':');
  if (!digest) return value;
  return `${kind}:${digest.slice(0, 10)}…${digest.slice(-8)}`;
}

function dateLabel(value?: string): string {
  if (!value) return 'time unavailable';
  return value.replace('T', ' · ').replace(/\.\d{3}Z$/, ' UTC');
}

function StatusMark({ status }: { status: string }) {
  return <span className={`report-status-mark is-${status}`}>{status}</span>;
}

function ReportHeader({ report }: { report: WorkSessionReportViewModel }) {
  const { envelope, projection } = report;
  return (
    <header className="report-header">
      <div className="report-title">
        <span className="report-kicker">WORK SESSION REPORT · ACCEPTED PUBLICATION</span>
        <div>
          <StatusMark status={projection.outcome.status} />
          <h1>{projection.outcome.headline}</h1>
        </div>
      </div>
      <div className="report-host-summary" aria-label="Report host identity">
        <span>Canvas host · public projection only</span>
        <code title={envelope.reportRevisionId}>
          {compactIdentity(envelope.reportRevisionId)}
        </code>
        <strong>Evidence-led report</strong>
      </div>
    </header>
  );
}

function IdentityStrip({ report }: { report: WorkSessionReportViewModel }) {
  return (
    <section className="report-identity-strip" aria-label="Accepted publication identity">
      <div>
        <span>Report revision</span>
        <code>{report.reportRevisionId}</code>
      </div>
      <div>
        <span>Public projection digest</span>
        <code>{report.publicProjectionDigest}</code>
      </div>
      <div>
        <span>Report-wide proof state</span>
        <strong data-proof-state={report.proofState.status}>
          {report.proofState.status} · exit {report.proofState.exitCode ?? '—'}
        </strong>
        <small>{report.proofState.command ?? report.proofState.label}</small>
        <a
          href={`/${report.envelope.html.path}`}
          rel="noreferrer"
          target="_blank"
        >
          Open accepted standalone report HTML
        </a>
      </div>
    </section>
  );
}

function OutcomeBrief({ projection }: { projection: PublishedReportProjection }) {
  return (
    <section className="report-outcome-brief">
      <div>
        <span className="report-section-label">Outcome</span>
        <h2>{projection.title}</h2>
        <p>{projection.outcome.summary}</p>
      </div>
      <dl className="report-stat-line">
        {Object.entries(projection.stats).map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReportAcceptanceContext({
  origin,
  report,
}: {
  origin: string;
  report: WorkSessionReportViewModel;
}) {
  return (
    <section
      className="report-evidence-path"
      aria-label="Report-level acceptance context"
    >
      <span className="report-section-label">Report-level acceptance context</span>
      <div className="report-acceptance-nodes">
      <span className="path-node">
        <small>Selected viewing context</small>
        <strong>{origin}</strong>
      </span>
      <span className="path-connector" aria-hidden="true">∈</span>
      <span className="path-node">
        <small>Contained in accepted public projection</small>
        <strong>{compactIdentity(report.reportRevisionId)}</strong>
      </span>
      <span className="path-connector" aria-hidden="true">+</span>
      <span className="path-node is-proof">
        <small>Report-wide acceptance proof — does not assert item-level causality</small>
        <strong>{report.proofState.label}</strong>
      </span>
      </div>
    </section>
  );
}

function EvidenceReference({
  evidence,
}: {
  evidence: PublishedReceipt['evidence'][number];
}) {
  const label = `${evidence.kind} · ${evidence.label}`;
  return evidence.href ? (
    <a href={`/${evidence.href}`} rel="noreferrer" target="_blank">{label}</a>
  ) : <span>{label}</span>;
}

function ProofReceipt({
  receipt,
  compact = false,
  primary = false,
}: {
  receipt: PublishedReceipt;
  compact?: boolean;
  primary?: boolean;
}) {
  return (
    <article className={`report-proof-receipt ${compact ? 'is-compact' : ''}`}>
      <span className="receipt-kind">
        {primary ? 'Primary report-wide proof' : `${receipt.type} receipt`}
      </span>
      <small className="receipt-scope">
        Report-wide acceptance proof — does not assert item-level causality
      </small>
      <h3>{receipt.title}</h3>
      <p>{receipt.summary}</p>
      {receipt.proof && (
        <dl>
          <div><dt>Command</dt><dd><code>{receipt.proof.command}</code></dd></div>
          <div><dt>Exit</dt><dd>{receipt.proof.exitCode}</dd></div>
          <div><dt>Captured</dt><dd>{dateLabel(receipt.proof.executedAt)}</dd></div>
          <div><dt>Output</dt><dd><code>{receipt.proof.outputDigest}</code></dd></div>
        </dl>
      )}
      <div className="receipt-evidence">
        {receipt.evidence.map((evidence, index) => (
          <EvidenceReference
            evidence={evidence}
            key={`${evidence.kind}:${evidence.label}:${index}`}
          />
        ))}
      </div>
    </article>
  );
}

function ReportProofs({
  projection,
  compact = false,
}: {
  projection: PublishedReportProjection;
  compact?: boolean;
}) {
  if (projection.proofs.length === 0) {
    return <p className="report-inline-empty">No report-wide proof receipt is present.</p>;
  }
  return (
    <div className="report-proof-stack">
      {projection.proofs.map((proof, index) => (
        <ProofReceipt
          compact={compact}
          key={proof.id}
          primary={index === 0}
          receipt={proof}
        />
      ))}
      {projection.proofs.length > 1 && (
        <p className="report-remaining-count">
          {projection.proofs.length - 1} additional report-wide proof receipt
          {projection.proofs.length === 2 ? '' : 's'} shown.
        </p>
      )}
    </div>
  );
}

function ValidationLadder({ report }: { report: WorkSessionReportViewModel }) {
  const { envelope, projection } = report;
  const proof = projection.proofs[0];
  const successfulProofs = projection.proofs.filter(
    (receipt) => receipt.proof?.exitCode === 0,
  ).length;
  const steps = [
    ['Source bound', compactIdentity(envelope.sourceDigest)],
    ['Receipts bound', `${envelope.receiptIds.length} authoritative references`],
    [
      'Primary executed proof',
      proof
        ? `exit ${proof.proof?.exitCode} · ${successfulProofs}/${projection.proofs.length} proofs successful`
        : 'missing',
    ],
    ['Accepted revision', compactIdentity(envelope.reportRevisionId)],
  ] as const;
  return (
    <section className="report-validation-ladder" aria-label="Report-level validation ladder">
      <span className="report-section-label">Report-level validation</span>
      <ol>
        {steps.map(([label, detail], index) => (
          <li key={label}>
            <b>{index + 1}</b>
            <span><strong>{label}</strong><small>{detail}</small></span>
          </li>
        ))}
      </ol>
      <p>
        Gate policy: digest mismatch → reject · any proof non-zero or source warning → reject.
      </p>
    </section>
  );
}

function NextAction({ projection }: { projection: PublishedReportProjection }) {
  const action = projection.nextActions[0];
  const remaining = Math.max(0, projection.nextActions.length - 1);
  return (
    <section className="report-next-action">
      <span className="report-section-label">Primary next action</span>
      {action ? (
        <>
          <StatusMark status={action.status} />
          <h3>{action.label}</h3>
          <p>
            {action.dependsOn.length > 0
              ? `Depends on ${action.dependsOn.join(', ')}.`
              : 'Ready without a recorded dependency.'}
          </p>
          {remaining > 0 && (
            <small className="report-remaining-count">
              +{remaining} remaining action{remaining === 1 ? '' : 's'}
            </small>
          )}
        </>
      ) : <p className="report-inline-empty">No next action is recorded.</p>}
    </section>
  );
}

const MAP_POSITIONS = [
  { left: 8, top: 13 },
  { left: 62, top: 11 },
  { left: 11, top: 63 },
  { left: 65, top: 63 },
] as const;

function CompactChangeMap({ projection }: { projection: PublishedReportProjection }) {
  const positions = Object.fromEntries(
    projection.changeMap.nodes.map((node, index) => [
      node.id,
      MAP_POSITIONS[index % MAP_POSITIONS.length],
    ]),
  );
  return (
    <section className="report-change-map">
      <div className="change-map-plot">
        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <marker id="report-map-arrow" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 z" />
            </marker>
          </defs>
          {projection.changeMap.edges.map((edge) => {
            const source = positions[edge.source];
            const target = positions[edge.target];
            if (!source || !target) return null;
            return (
              <line
                key={edge.id}
                markerEnd="url(#report-map-arrow)"
                x1={source.left + 12}
                x2={target.left + 12}
                y1={source.top + 10}
                y2={target.top + 10}
              />
            );
          })}
        </svg>
        {projection.changeMap.nodes.map((node, index) => {
          const position = MAP_POSITIONS[index % MAP_POSITIONS.length];
          return (
            <article
              className="change-map-node"
              key={node.id}
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
            >
              <span>«{node.role}»</span>
              <strong>{node.label}</strong>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReceiptCard({
  receipt,
  selected,
  select,
}: {
  receipt: PublishedReceipt;
  selected: boolean;
  select: (id: string) => void;
}) {
  return (
    <article
      className={`evidence-wall-card is-${receipt.type} ${selected ? 'is-selected' : ''}`}
    >
      <button
        aria-label={`${receipt.title}${selected ? ', selected' : ''}`}
        aria-pressed={selected}
        onClick={() => select(receipt.id)}
        type="button"
      >
        <span>{receipt.type} receipt</span>
        <strong>{receipt.title}</strong>
      </button>
      <p>{receipt.summary}</p>
      {receipt.proof && (
        <div className="wall-proof-state">
          <b>Exit {receipt.proof.exitCode}</b>
          <code>{receipt.proof.command}</code>
        </div>
      )}
      <small>{receipt.evidence.length} evidence reference{receipt.evidence.length === 1 ? '' : 's'}</small>
    </article>
  );
}

function WorkSessionReportView({ report }: { report: WorkSessionReportViewModel }) {
  const { projection } = report;
  const receipts = reportReceipts(projection);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | undefined>(receipts[0]?.id);
  const selectedReceipt = selectReceipt(projection, selectedReceiptId);
  return (
    <main className="report-view">
      <div className="evidence-wall-intro">
        <OutcomeBrief projection={projection} />
        <NextAction projection={projection} />
      </div>
      <div className="evidence-wall-layout">
        <section className="evidence-wall">
          <div className="wall-heading">
            <div><span>Primary surface</span><strong>Accepted receipts</strong></div>
            <small>Proof and artifacts first · select a receipt to inspect its published evidence</small>
          </div>
          <div className="evidence-wall-grid">
            {receipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                select={setSelectedReceiptId}
                selected={receipt.id === selectedReceipt?.id}
              />
            ))}
          </div>
        </section>
        <aside className="wall-context">
          <span className="report-section-label">Selected receipt</span>
          <p className="wall-receipt-type">{selectedReceipt?.type ?? 'none'}</p>
          <h2>{selectedReceipt?.title ?? 'No public receipt'}</h2>
          <p>{selectedReceipt?.summary}</p>
          <code>{selectedReceipt?.id}</code>
          <div className="wall-evidence-list">
            {selectedReceipt?.evidence.map((evidence, index) => (
              <div key={`${evidence.kind}:${evidence.label}:${index}`}>
                <EvidenceReference evidence={evidence} />
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="wall-report-gates">
        <div className="wall-report-validation">
          <ReportAcceptanceContext
            origin={selectedReceipt?.title ?? 'No receipt'}
            report={report}
          />
          <ValidationLadder report={report} />
        </div>
        <section className="wall-report-proof">
            <span className="report-section-label">Separate report-wide proof</span>
            <ReportProofs compact projection={projection} />
        </section>
      </div>
      <div className="wall-context-maps">
        <section>
          <div className="report-panel-heading">
            <span>Compact map</span>
            <strong>Where the accepted change landed</strong>
          </div>
          <CompactChangeMap projection={projection} />
        </section>
        <section className="wall-workflow">
          <div className="report-panel-heading">
            <span>Workflow context</span>
            <strong>How receipts became a revision</strong>
          </div>
          <ol>
            {projection.workflow.map((step) => (
              <li key={step.id}>
                <StatusMark status={step.status} />
                <div><strong>{step.label}</strong><small>{step.detail}</small></div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <IdentityStrip report={report} />
    </main>
  );
}

export function ReportStatePanel({
  state,
  message,
  retry,
}: {
  state: 'loading' | 'invalid' | 'empty';
  message?: string;
  retry?: () => void;
}) {
  const content = {
    loading: {
      label: 'Reading accepted publication',
      title: 'Loading the public report projection…',
      body: 'Canvas is validating /reports/accepted-report.json before any report content renders.',
      action: 'If this stalls, confirm the Vite server can serve the checked-in report envelope.',
    },
    invalid: {
      label: 'Public contract rejected',
      title: 'This report cannot be displayed safely.',
      body: message ?? 'The publication did not match the accepted-report envelope schema.',
      action: 'Run npm run report:show to inspect the selected publication, then retry.',
    },
    empty: {
      label: 'Accepted projection is empty',
      title: 'There is no report evidence to arrange yet.',
      body: 'The envelope is valid, but it contains no workflow, changed modules, receipts, or next action.',
      action: 'Generate a report with structured receipts to populate this view.',
    },
  }[state];
  return (
    <main
      className={`report-state-panel is-${state}`}
      role={state === 'invalid' ? 'alert' : 'status'}
    >
      <span>{content.label}</span>
      <h1>{content.title}</h1>
      <p>{content.body}</p>
      <strong>{content.action}</strong>
      {state === 'invalid' && retry && <button onClick={retry} type="button">Retry public report</button>}
    </main>
  );
}

export function WorkSessionReport() {
  const [screen, setScreen] = useState<ReportScreenState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setScreen({ status: 'loading' });
    void fetch('/reports/accepted-report.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} while reading the public report.`);
        return response.json() as Promise<unknown>;
      })
      .then((input) => {
        const hydrated = hydratePublishedReport(input);
        if (!hydrated.ok) {
          setScreen({ status: 'invalid', message: hydrated.message });
          return;
        }
        setScreen(projectionIsEmpty(hydrated.report.projection)
          ? { status: 'empty', report: hydrated.report }
          : { status: 'ready', report: hydrated.report });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setScreen({
          status: 'invalid',
          message: error instanceof Error ? error.message : 'The public report could not be loaded.',
        });
      });
    return () => controller.abort();
  }, [attempt]);

  if (screen.status === 'loading') return <ReportStatePanel state="loading" />;
  if (screen.status === 'invalid') {
    return (
      <ReportStatePanel
        message={screen.message}
        retry={() => setAttempt((value) => value + 1)}
        state="invalid"
      />
    );
  }
  if (screen.status === 'empty') return <ReportStatePanel state="empty" />;
  return (
    <div className="work-session-report">
      <ReportHeader report={screen.report} />
      <WorkSessionReportView report={screen.report} />
    </div>
  );
}
