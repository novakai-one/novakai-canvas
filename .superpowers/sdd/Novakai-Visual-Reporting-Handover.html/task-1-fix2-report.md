# Task 1 pressure-gate remediation round 2 report

## Result

All six reproduced authority gates are closed within the local single-writer POC.
Repository receipts now bind to exact repository bytes; hydrated projections are
re-derived from authoritative sessions and receipts; public JSON and deterministic
HTML are semantically reconciled; unsupported content cannot silently disappear;
Canvas is represented only as pending work; and successful proof copies must match
structured authoritative proof receipts.

Implementation commit:
`7c86eb28b84e23bccdd3413586a72f88f6dcef3c`

Final accepted revision:
`report:0d18adecdfad56e74a7fc04a659c7375453196e11aa21037ed41bf3a6f034273`

## Files changed

- Public contract and authority:
  `src/capabilities/work-session-reporting/contract.ts`,
  `src/capabilities/work-session-reporting/core/report-compiler.ts`,
  `src/capabilities/work-session-reporting/core/reporting-engine.ts`.
- Local adapters and publication:
  `tools/report-session/cli.ts`,
  `tools/report-session/codex-session-source.ts`,
  `tools/report-session/html-renderer.ts`,
  `tools/report-session/publish-report.ts`,
  `tools/report-session/repository-evidence.ts`.
- Regression coverage:
  `src/capabilities/work-session-reporting/reporting-engine.test.ts`,
  `tools/report-session/report-session.test.ts`.
- Accepted artifacts:
  `public/reports/accepted-report.json` and
  `docs/visual-reporting/reports/report-0d18adecdfad56e74a7fc04a659c7375453196e11aa21037ed41bf3a6f034273.html`
  (replacing the superseded immutable HTML revision).

## Reproductions before and after

1. **Repository byte freshness**
   - Before: bases `31792d15f564a67729535ca275dc56826a85750b` and
     `283af7b` produced byte-identical receipt inputs despite different trees.
   - After: every repository receipt carries bounded SHA-256 evidence for the
     resolved base commit/tree, HEAD commit/tree, canonical patch, and current
     file contents. The regression records both inputs through the authority and
     proves both receipt IDs and receipts digests differ.

2. **Hydration re-derivation**
   - Before: deleting authoritative receipts or changing derived statistics and
     recomputing `projectionDigest` survived hydration.
   - After: draft and accepted-report receipt references are unique, canonical,
     session/source-correct, and resolved against authoritative receipts.
     Hydration recompiles the exact projection and rechecks receipts digest,
     report identity, projection digest, counts, workflow, completion policy,
     accepted-key uniqueness, and byte-equality of all derived receipt copies.
     Missing, duplicate, extra, wrong-session, wrong-source, byte-different, and
     hostile-stat variants now reject.

3. **Public envelope and deterministic HTML**
   - Before: a re-digested envelope could disagree with its public revision and
     counts while independently supplied HTML displayed another value.
   - After: `authoritativeProjectionDigest` and `publicProjectionDigest` have
     explicit meanings. Verification reconciles top-level identity fields,
     receipt claims, every category count, change-map counts, completion policy,
     and the exact deterministic renderer output. The reproduced revision/count
     tamper and hostile re-digested HTML both reject.

4. **Parser warning preservation**
   - Before: metadata plus an unsupported top-level user/content record could
     become `complete=true`, `eventCount=0`, and `warnings=[]`.
   - After: content-bearing unsupported top-level records, response items, and
     message blocks emit typed `UnsupportedContent` warnings. Known tool and
     telemetry records remain explicitly allowlisted. Completion rejects any
     warning and zero normalized events.

5. **No premature Canvas-host claim**
   - Before: repository receipts and standalone HTML claimed an embedded Canvas
     consumer before that host existed.
   - After: no Canvas node, relation, decision, or embedded-host claim is
     published. The final report contains exactly one Canvas reference:
     `Canvas host pending`, as a queued next action.

6. **Proof authority**
   - Before: hostile embedded/public proof copies could be used as completion
     evidence without exact receipt reconciliation.
   - After: proof receipts require command, exit code, execution time, output
     digest, and evidence. Hydration and publication creation reconcile exact
     proof copies to authoritative receipts; public verification reconciles proof
     copies to the accepted receipt claims and completion requires a successful
     structured command proof.

The CLI additionally binds reusable `npm run check` proof to the deterministic
repository receipt set. Generated public JSON, immutable HTML, private
`.novakai-reports` state, and this administrative report are excluded from source
evidence. Canonical private-state serialization makes unchanged final generation
byte-idempotent.

## Commands and exact results

- `npx vitest run src/capabilities/work-session-reporting/reporting-engine.test.ts tools/report-session/report-session.test.ts`
  — 2 files passed, 25 tests passed, 0 failed.
- Repeated-generation regression
  `-t "repeats final generation byte-idempotently when source, base, and code are unchanged"`
  — 1 passed; report revision, public envelope, HTML, private state, and tracked
  Git status were byte-identical.
- Repository-byte regression
  `-t "binds repository receipts to changed bytes"`
  — 1 passed; receipt IDs and receipts digests differed for the two reproduced
  bases.
- `npm run check`
  — exit 0; lint passed; 15 test files passed; 111 tests passed, 0 failed;
  tool TypeScript passed; application TypeScript/build passed; 280 modules
  transformed.
- Import architecture gate
  `npx vitest run tools/report-session/report-session.test.ts -t "reporting architecture boundary"`
  — 1 passed, 0 failed.
- Final generation, executed twice with unchanged inputs:
  `node tools/report-session/cli.ts generate --final --session tools/report-session/fixtures/codex-session.jsonl --complete --state .novakai-reports/fix2-final7-state.json`
  — both runs returned exact revision
  `report:0d18adecdfad56e74a7fc04a659c7375453196e11aa21037ed41bf3a6f034273`,
  receipts digest
  `sha256:8e507e7efae13c70a5c6bdd3709b23cf221d0d7ad857dd205e5af3979d2f4d8f`,
  and publication digest
  `sha256:1eb8c1e4fcdb560f958f2b575797d184902ee5b2416a24183094d34dc0499d61`.
- Exact `show` — exit 0; changes 3, decisions 2, proofs 1, blockers 0,
  artifacts 1, and the selected immutable HTML path matched the revision.
- `git diff --check` — exit 0.

The pre-existing Vitest close-timeout message and Vite 519.49 kB chunk warning
remain non-failing, as permitted by the brief.

## Privacy proof

Literal scans of `public/reports`, `docs/visual-reporting/reports`, and
`dist/reports` returned zero matches for both raw fixture prompt fragments, the
fixture working directory, `/Users/`, `/home/`, Windows user paths, `$HOME`,
`$CODEX_HOME`, `sourceRef`, `.jsonl`, `providerEventId`, event arrays, or content
payload fields. Runtime tests perform the same checked-in JSON/HTML assertions.
Public evidence contains bounded digests and redacted labels only; raw patches,
session events, source references, command output excerpts, and private state do
not cross the publication boundary.

## Residual risks

- **Medium severity, high confidence:** publication hashes provide deterministic
  consistency, not authenticated signatures. The trusted local CLI/authority must
  remain the single writer; a malicious party able to replace and fully re-sign
  every local artifact is outside this POC's threat model.
- **Medium severity, high confidence:** `--complete` is explicit local operator
  confirmation, not provider-authenticated terminal state or multi-user
  authorization. This is intentional for the current POC.
- **Low severity, high confidence:** a process crash can leave a stale lock or an
  unselected immutable HTML file. The public pointer is written last, preventing a
  partially written revision from becoming selected.
- **Low severity, high confidence:** Vitest still reports its pre-existing close
  timeout after successful runs, and Vite reports the pre-existing bundle-size
  warning. Neither affected test or build exit status.
