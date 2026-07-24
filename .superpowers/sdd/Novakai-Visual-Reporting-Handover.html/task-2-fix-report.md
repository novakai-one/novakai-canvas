# Task 2 pressure-gate remediation report

## Status and commit

Complete. The remediation implementation and final browser evidence are committed
at:

```text
7d0c5e9cacccc3d7947391cc5d2e1d8ac847dfaa
```

No variant was promoted or deleted. Architecture JSON and Canvas preferences were
not changed.

## Integrity and host parity

- Added the public, synchronous, browser-safe
  `verifyPublishedProjectionEnvelope(unknown)` capability.
- The verifier owns schema, publication/projection digests, top/projection
  identity, receipt-reference/claim coverage, derived counts, and completion
  invariants.
- Browser hydration and Node HTML verification call that same semantic verifier;
  the Node path adds only HTML digest and deterministic-renderer byte checks.
- Re-signed headline, revision, receipt, stats, proof-exit, and digest mutations
  are rejected by the shared verifier, browser hydration, and CLI/HTML host.
- Valid host parity compares the complete public projection plus revision,
  source/receipt/projection digests, full outcome, and all counts.
- The checked publication and deterministic HTML verify together through
  `npm run --silent report:show`.

## Truthful UI and safe controls

- Replaced the implied item-to-proof chain with **report-level acceptance
  context**.
- Every proof surface says:
  `Report-wide acceptance proof — does not assert item-level causality`.
- A changes workflow viewing context and keeps validation separate.
- B changes selected module context and connected wires; decisions and proof stay
  report-wide.
- C shows the selected receipt's actual published evidence and places report-wide
  proof in a separate gate surface.
- Added the report validation ladder:
  source bound → receipts bound → executed proof exit state → accepted revision.
- Gate annotations state the policy without claiming a rejection occurred:
  digest mismatch → reject; completion proof non-zero or source warning → reject.
- Primary proof and primary next action are explicit; additional-item counts
  appear when applicable.
- Approved repository-relative HTML artifacts can carry `href`. Absolute,
  dot-dot, script/non-HTML, unapproved, and falsely typed links are rejected.
  Approved evidence and accepted report HTML render as real anchors.
- C's compact map nodes are noninteractive articles.

## Responsive, accessibility, and route isolation

- A preserves workflow, changed modules, report-wide proof, decisions, and next
  action at 390px. Its workflow/modules use accessible horizontal overflow, and
  its proof dock reflows instead of disappearing.
- Loading/empty states use `role=status`; invalid uses `role=alert`.
- The variant switcher is a labelled `role=group`; selected controls carry
  selected text and visible focus.
- Arrow switching ignores anchors, buttons, inputs, selects, textareas,
  contenteditable, and interactive ARIA controls.
- Visible metadata computes to at least 10px.
- Muted/faint text contrast ranges from 5.21:1 to 7.72:1 across prototype panel
  backgrounds.
- `main.tsx` resolves the development-only work-session route before importing
  App, repositories, the Canvas engine, data schemas/defaults, Canvas CSS, or
  ReactFlow CSS. Chrome confirmed no Canvas data or ReactFlow request on the
  prototype route.
- Production assets contain no prototype route, component, layout, or
  report-level-context strings.

## Verification

Final command:

```text
npm run check
17 test files passed
122 tests passed
lint passed
tools TypeScript passed
application TypeScript passed
production Vite build passed
```

Additional gates:

```text
focused reporting/hydration: 3 files, 23 tests passed
focused source/a11y/isolation: 2 files, 10 tests passed
Chrome runtime/interaction assertions: 23 passed
Chrome console warnings/errors: 0
Chrome failed network requests: 0
git diff --check: passed
private capability import scan: 0
privacy scan: 0
production prototype-string scan: 0
public/data changes: 0
```

The existing Vitest post-success close-timeout diagnostic still prints, but the
suite exits successfully. No final report generation or reporting-authority
state churn was performed.

## Real Chrome evidence

The in-app Browser runtime was initialized and its required troubleshooting
path completed, but discovery returned no browser backend. The approved fallback
used installed Google Chrome 150 through CDP against the actual Vite-rendered
React route. Port 5173 was occupied by the unrelated main checkout, so the
isolated worktree ran on 5174.

Interactions verified:

- A workflow selection updates its central context.
- B module selection updates the inspector and connected wire emphasis.
- C receipt selection updates the actual evidence list and exposes an approved
  handover anchor.
- Global arrows switch variants; focused workflow buttons and an input retain
  their expected arrow behavior.
- C compact map contains articles and no buttons.
- A mobile retains every mandatory information surface.

Full-page screenshots, all visually inspected:

- `docs/visual-reporting/screenshots/prototypes/work-session-report-A-desktop-remediated.png`
  — 1440 × 1111
- `docs/visual-reporting/screenshots/prototypes/work-session-report-A-mobile-390-remediated.png`
  — 390 × 2348
- `docs/visual-reporting/screenshots/prototypes/work-session-report-B-desktop-remediated.png`
  — 1440 × 1717
- `docs/visual-reporting/screenshots/prototypes/work-session-report-B-mobile-390-remediated.png`
  — 390 × 2566
- `docs/visual-reporting/screenshots/prototypes/work-session-report-C-desktop-remediated.png`
  — 1440 × 1542
- `docs/visual-reporting/screenshots/prototypes/work-session-report-C-mobile-390-remediated.png`
  — 390 × 3106

Inspection confirmed no clipped A proof dock, no hidden A mobile sections, clear
B selected-module/wire state, and complete C evidence/context/proof separation.
C's desktop dead field was removed: report-level gates begin around 805px and
the compact map/workflow begin around 1055px.

## Strongest variant

**C — Evidence wall** is the strongest pressure-tested candidate. Its primary
interaction selects a real published receipt, the inspector changes to that
receipt's actual evidence, approved artifacts are actionable, and report-wide
acceptance proof remains explicitly separate. After compaction, the report-level
gates and lower map/workflow context are visible within roughly the first 1100px
on desktop. This is evidence for Task 3 selection, not a promotion in Task 2.

## Residual risks

- The publication digest proves internal byte consistency, not signer
  authenticity; no signature or multi-user authorization is claimed.
- The artifact-link allowlist is intentionally narrow and must be extended
  deliberately if new public HTML artifact classes are introduced.
- Browser evidence used the approved Chrome/CDP fallback because the in-app
  backend was unavailable.
- The throwaway controller/styles remain intentionally large until Task 3
  deletes losing layouts and splits the chosen variant.
- The checked accepted report remains the existing reporting projection; this
  task did not regenerate or reinterpret reporting authority.
