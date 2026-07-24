# Task 2 — pressure-gate remediation round 2 report

## Result

All four requested gates are closed in implementation commit
`273ac09c5f38c1ee844fb1a607d460bf46309c40`.

No variant was promoted or removed. No report authority state or checked-in
publication was regenerated.

## Gate 1 — mixed proof outcomes

- Reporting authority completion now requires at least one proof and requires
  every authoritative proof exit code to be zero.
- `acceptReport` rechecks the completion policy against current authoritative
  receipts before acceptance.
- Publication construction and public envelope verification apply the same
  all-proofs-success invariant.
- Exact `[0,1]` regressions cover core compile, core accept, public safe and
  assertion verification, browser hydration, and Node HTML verification.
- Variant B labels the displayed proof as `Primary executed proof` and states
  that any non-zero proof rejects completion.

## Gate 2 — typed public verification

The capability exports a discriminated
`PublishedReportVerificationResult`, `safeVerifyPublishedProjectionEnvelope`,
and the convenience assertion `verifyPublishedProjectionEnvelope`.
Assertion failures are `PublishedReportVerificationError` instances carrying
one of these stable codes:

```text
SchemaInvalid
PublicationDigestMismatch
ProjectionIdentityMismatch
ProjectionDigestMismatch
ReceiptCoverageMismatch
DerivedStatsMismatch
CompletionPolicyFailed
ReportHtmlPathMismatch
HtmlDigestMismatch
HtmlRendererMismatch
```

Browser hydration consumes the safe result directly and preserves the failure
code. Tests assert representative schema, publication digest, projection
digest, receipt coverage, stats, completion/proof, and HTML-path codes.

## Gate 3 — report-bound HTML

The semantic verifier requires the exact path:

```text
docs/visual-reporting/reports/report-<reportRevisionId digest>.html
```

Publisher output now always records that canonical repository path while the
CLI may still use an isolated physical output directory for tests. Other
relative HTML, the handover HTML, traversal, absolute, script, and
revision-mismatched paths are rejected. The evidence-href allowlist remains
unchanged.

## Gate 4 — rendered wire contrast

Inactive Variant B wire-ledger rows no longer apply whole-row opacity.
De-emphasis is limited to the row background and border.

Installed Google Chrome verified both viewports against the live Vite route:

- Desktop: 1440 × 900 viewport; 1440 × 1593 capture.
- Mobile: 390 × 844 viewport; 390 × 2566 capture.
- Three inactive rows per viewport computed to opacity `1`.
- Effective rendered contrast across 18 text samples was:
  - labels: 6.13:1
  - wire IDs: 7.35:1
  - titles: 15.87:1
- Module selection updated and restored at both viewports.
- Horizontal overflow: 0.
- Console warnings/errors: 0.
- Runtime exceptions: 0.
- Failed requests: 0.
- HTTP errors: 0.

Captures:

- `docs/visual-reporting/screenshots/work-session-report-B-desktop-fix2.png`
- `docs/visual-reporting/screenshots/work-session-report-B-mobile-390-fix2.png`

Both captures were visually inspected. The inactive wire content is legible,
the connected wire remains distinct, and no new clipping or layout failure is
present.

## Verification

```text
Focused reporting/publication/hydration:
4 test files passed
40 tests passed

npm run check:
lint passed
17 test files passed
126 tests passed
tools TypeScript passed
application TypeScript passed
production Vite build passed
281 modules transformed
```

Final scans:

```text
git diff --check: passed
private capability import scan: 0
public report/HTML privacy scan: 0
production asset prototype-string scan: 0
public/data changes: 0
public/reports changes: 0
```

The existing Vitest post-success close-timeout diagnostic still prints before
the command proceeds; the full check exits successfully. The in-app browser
runtime exposed no browser backend, so the approved installed Chrome/CDP
fallback was used. No product-code residual remains for these four gates.
