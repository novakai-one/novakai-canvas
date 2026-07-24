import type { ReportProjection, WorkReceipt } from '../../src/capabilities/work-session-reporting/contract.ts';

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function receiptCards(receipts: readonly WorkReceipt[], empty: string): string {
  if (receipts.length === 0) return `<p class="empty">${escape(empty)}</p>`;
  return receipts.map((receipt) => `
    <article class="receipt">
      <span class="receipt-type">${escape(receipt.type)}</span>
      <h3>${escape(receipt.title)}</h3>
      <p>${escape(receipt.summary)}</p>
      <div class="evidence">${receipt.evidence.map((item) =>
        `<span>${escape(item.kind)} · ${escape(item.label)}</span>`).join('')}</div>
    </article>`).join('');
}

function changeMap(projection: ReportProjection): string {
  if (projection.changeMap.nodes.length === 0) {
    return '<p class="empty">No changed modules were recorded.</p>';
  }
  const nodes = projection.changeMap.nodes.map((node) => `
    <article class="map-node" data-role="${escape(node.role)}">
      <span>«${escape(node.role)}»</span>
      <strong>${escape(node.label)}</strong>
      <small>${node.receiptCount} direct change receipt${node.receiptCount === 1 ? '' : 's'}</small>
    </article>`).join('');
  const edges = projection.changeMap.edges.map((edge) => `
    <li><code>${escape(edge.source)}</code> → <code>${escape(edge.target)}</code>
      <strong>${escape(edge.label)}</strong></li>`).join('');
  return `<div class="map-nodes">${nodes}</div><ul class="edge-list">${edges}</ul>`;
}

/** Deterministic, dependency-free second-host rendering of an accepted report projection. */
export function renderStandaloneReport(projection: ReportProjection): string {
  const status = projection.outcome.status;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(projection.outcome.headline)} · Novakai Work Session</title>
  <style>
    :root{--ink:#132033;--muted:#607086;--paper:#f3f6fb;--card:#fff;--line:#ccd6e4;--blue:#245bb5;--blue2:#e9f1ff;--violet:#6947b8;--violet2:#f1ecff;--green:#18764f;--green2:#e9f8f1;--rose:#a33d5e;--rose2:#fff0f4}
    *{box-sizing:border-box}body{margin:0;color:var(--ink);background:radial-gradient(circle at 8% 0%,#dce8ff 0,transparent 32rem),var(--paper);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}
    main{width:min(1180px,calc(100% - 32px));margin:auto;padding:42px 0 70px}.eyebrow,.receipt-type{display:inline-flex;padding:5px 9px;border-radius:999px;background:var(--violet2);color:var(--violet);font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}
    h1{max-width:880px;margin:16px 0 10px;font-size:clamp(38px,6vw,72px);line-height:1;letter-spacing:-.05em}.lead{max-width:820px;color:var(--muted);font-size:20px}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.meta span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:12px}
    .hero{padding:24px;border-radius:22px;background:linear-gradient(135deg,#17335f,#275db7 60%,#6848b8);color:#fff}.hero p{max-width:800px;color:#e8efff;font-size:18px}.status{display:inline-flex;padding:6px 10px;border-radius:999px;background:${status === 'complete' ? 'var(--green2)' : 'var(--rose2)'};color:${status === 'complete' ? 'var(--green)' : 'var(--rose)'};font-weight:850;text-transform:uppercase;font-size:11px}
    .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:14px 0 30px}.stat{padding:16px;border:1px solid var(--line);border-radius:15px;background:#fff}.stat b{display:block;font-size:28px;color:var(--blue)}section{margin-top:30px}section>h2{margin:0 0 12px;font-size:30px;letter-spacing:-.03em}
    .map-nodes,.cards,.workflow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.map-node,.receipt,.step{padding:17px;border:1px solid var(--line);border-radius:15px;background:#fff}.map-node span{color:var(--muted);font-size:11px;font-weight:800}.map-node strong,.map-node small{display:block}.map-node strong{margin:8px 0}.map-node[data-role=module]{border-top:4px solid var(--green)}.map-node[data-role=adapter]{border-top:4px solid var(--violet)}.map-node[data-role=caller]{border-top:4px solid var(--blue)}
    .edge-list{margin:12px 0 0;padding:0;list-style:none}.edge-list li{padding:9px 0;border-bottom:1px solid var(--line)}.edge-list strong{margin-left:10px}.step{position:relative;padding-left:54px}.step b{position:absolute;left:16px;top:16px;display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:var(--blue2);color:var(--blue)}.step span{display:block;color:var(--muted);font-size:13px}
    .receipt h3{margin:10px 0 5px}.receipt p{color:var(--muted)}.evidence{display:flex;flex-wrap:wrap;gap:6px}.evidence span{padding:4px 7px;border-radius:7px;background:#f1f5f9;font-size:11px}.next{display:grid;gap:8px}.next div{padding:13px;border-left:4px solid var(--blue);border-radius:8px;background:#fff}.empty{padding:18px;border:1px dashed var(--line);border-radius:14px;color:var(--muted)}
    footer{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font:12px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
    @media(max-width:760px){.stats{grid-template-columns:repeat(2,1fr)}.map-nodes,.cards,.workflow{grid-template-columns:1fr}}
  </style>
</head>
<body>
<main>
  <span class="eyebrow">Accepted work-session report · standalone host</span>
  <h1>${escape(projection.outcome.headline)}</h1>
  <p class="lead">${escape(projection.outcome.summary)}</p>
  <div class="meta">
    <span>${escape(projection.source.provider)}</span>
    <span>${projection.source.eventCount} normalized events</span>
    <span>${projection.source.complete ? 'complete source' : 'incomplete source'}</span>
    <span>${escape(projection.source.updatedAt ?? 'time unavailable')}</span>
  </div>
  <div class="hero"><span class="status">${escape(status)}</span><h2>${escape(projection.title)}</h2><p>One accepted revision drives this page and the embedded Canvas view.</p></div>
  <div class="stats">
    ${Object.entries(projection.stats).map(([label, value]) => `<div class="stat"><b>${value}</b>${escape(label)}</div>`).join('')}
  </div>

  <section><h2>What changed?</h2>${changeMap(projection)}</section>
  <section><h2>How did the report become trustworthy?</h2><div class="workflow">
    ${projection.workflow.map((step, index) => `<article class="step"><b>${index + 1}</b><strong>${escape(step.label)}</strong><span>${escape(step.detail)}</span></article>`).join('')}
  </div></section>
  <section><h2>What proves it?</h2><div class="cards">${receiptCards(projection.proofs, 'No proof receipts were recorded.')}</div></section>
  <section><h2>Which decisions matter?</h2><div class="cards">${receiptCards(projection.decisions, 'No architectural decisions were recorded.')}</div></section>
  <section><h2>What remains?</h2><div class="next">
    ${projection.nextActions.length === 0 ? '<p class="empty">Nothing remains inside the POC scope.</p>' : projection.nextActions.map((action) => `<div><strong>${escape(action.label)}</strong> · ${escape(action.status)}</div>`).join('')}
  </div></section>
  <footer>reportRevisionId=${escape(projection.reportRevisionId)} · sourceDigest=${escape(projection.sourceDigest)} · renderer=standalone-html-v1</footer>
</main>
</body>
</html>`;
}
