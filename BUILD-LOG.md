# Build log — Canvas record model

> **These are builder decisions, not laws.** Everything here is a choice I made while
> building, with the reasoning attached so Chris can overturn any of it cheaply. Where I
> assumed something, it says **ASSUMPTION** and states what would falsify it.
>
> **Builder:** Claude (Anthropic) · **Started:** 2026-08-06 · **Branch:** `claude/canvas-record-model`
> **Worktree:** `~/Programming/Novakai-Canvas/.worktrees/canvas-record-model` (isolated; Chris's
> working tree and `main` untouched).

## Requirements I am building against

Supplied by Chris, quoted from his own words. He said "5 is a minimum not a maximum. The
requirements named are all requirements" — so all seven bind.

R1 ordinary canvas ergonomics · R2 AI authors without coordinates · R3 slice-safe layout that
respects manual work · R4 typed node kinds · R5 diagram library · R6 Edit/Present never
contradict · R7 wire control with stable ports.

## Process I am following

`build-spec` (Novakai): requirements gate → Pass 1 blueprint (21 sections) → **fresh
zero-context adversarial ratification** → Pass 2 contracts → build in vertical slices.
Companion skills: `elite-codebase-engineering`, `engineering-standards`.

Per slice: contract first → characterisation test against Chris's real data → let `tsc`
enumerate the blast radius → one adapter + one consumer → delete the superseded path → prove →
commit. Gates each slice: `npm run check` and a recorded `novakai-analytics` score.

## Baseline recorded before touching anything

| Measure | Value |
|---|---|
| Branch point | `d7b6bea` (Codex's HEAD on `codex/canvas-product-decisions`) |
| Tests | 158 pass / 3 fail — all 3 pre-existing in work-session-report publication |
| Analytics, repo-wide | **65/100** — red: complexity 5, giantFiles 37, deadExports 36 |
| Canvas core size | 4,236 non-test LOC |
| Reporting experiment | ~5,500 LOC — owns every red dimension and all 3 failures |
| `ArchitectureDocument` blast radius | 38 files |

**Ratchet rule (Chris's instruction):** new Canvas code scores >86; repo-wide score must never
drop below 65. The reporting experiment is not mine to touch — including its 3 red tests.

## Decisions

### D-001 — Leave the work-session-reporting experiment completely alone
Chris chose "just ratchet" over extracting or remediating it. So it keeps its 3 failing tests
and its red dimensions, and I report two numbers honestly: repo-wide (must not fall below 65)
and Canvas-scoped (must exceed 86). I will never quietly re-scope a measurement to flatter a
result — if the Canvas number is scoped, it is labelled scoped.

### D-002 — Blueprint before code, ratified by an agent that has never seen this conversation
Self-ratification inherits my own blind spots silently. A fresh reviewer with repo access is
auditing the blueprint against the real data before any code is written.
See `docs/blueprint/2026-08-06-canvas-capability-blueprint.md`.

### D-003 — The migration is one-way and gets tested against Chris's real diagrams first
v2 → v3 runs at the storage seam; the domain never sees v2. Before writing the migration I
write the golden-file test that loads the real 17-map file **and** a read-only copy of Chris's
uncommitted working file (4,128 lines of diagram work sitting in his tree) and asserts nothing
is lost. That test goes red first.

**ASSUMPTION:** Chris's uncommitted `public/data/project-architecture.json` is diagram work he
wants preserved, not scratch. Falsified if he says it's throwaway — then only the committed
file matters.

### D-004 — There are TWO real input shapes, not one, and I have both
The file committed at `d7b6bea` is **schemaVersion 1** (geometry embedded on nodes, no
diagrams, no layouts). Chris's uncommitted working file is **schemaVersion 2** — it is the
output of Codex's v1→v2 migration, written back by the app when he ran it. So v2 exists in
exactly one place: his working tree.

Both are now captured as read-only fixtures (his tree untouched):
`src/domain/migrate/fixtures/real-v1-committed.json` and `real-v2-working-copy.json`.

Decision: migrate **v1→v2→v3 as a chain**, reusing the existing tested v1→v2 step rather than
writing a second v1→v3 path. One fact, one place.

### D-005 — Two hazards found in the real data that the blueprint did not cover

Measured, not guessed. Both would have been silent data loss.

**H1 — one cross-diagram wire exists.** `session` ("Agent session", inside `project-scope`)
—*"is a"*→ `msg-agents` ("Agent PTYs", inside `messaging-scope`). Under per-diagram records a
wire belongs to exactly one diagram, so this relationship has no home.

Rejected: dropping it (silent loss); converting it to a shared `subjectRef` (asserts the two
are the same real thing — I can't verify that, and guessing meaning is how diagrams become
wrong); letting endpoints carry a foreign `diagramId` (poisons the isolation guarantee that
makes per-diagram records worth having).

Taken: preserve it as a **library-owned cross-diagram link** — the library already owns
cross-record truth (§10), so the fact keeps an authority without any diagram claiming it.
n=1 in real data, so this is deliberately the smallest concept that loses nothing.
**Chris can overturn this** — the alternative he might prefer is "just make it a subject link."

**H2 — three comment nodes belong to no diagram at all.** `note-scope`, `note-messaging`,
`note-browser` sit at top level with no parent and are not diagram roots, so the current focus
path cannot reach them. They contain real writing, e.g. *"One session ⇢ one instance. No
shared tab, so nothing to fight over…"*.

Taken — **and changed after review**: they go to a visible **Unfiled** diagram, and the
migration report names all three. I first chose to attach them to the diagram their ID and
content indicate (`note-browser` → `browser-scope`, and so on), which reads as helpful and is
really a guess about Chris's intent baked irreversibly into his data. Zero interpretation and a
visible bucket he can empty in ten seconds beats a clever guess he never sees.
**ASSUMPTION:** Chris wants them kept at all. Falsified if he says they were scratch — then
Unfiled is where he deletes them from, which is also fine.

### Real-data facts the migration must satisfy (measured 2026-08-06)

| Fact | Value | Why it matters |
|---|---|---|
| Diagrams / nodes / wires | 17 / 259 / 287 | Migration target counts |
| Node kinds in use | scope 54, module 112, object 44, runtime 14, resource 18, comment 17 | R4's real vocabulary |
| Nested scopes (true groups) | 37 | Become `kind: 'group'` |
| Top-level scopes that are diagram roots | 17 of 17 | Root dissolution is clean |
| Wires touching a diagram root | **0** | LBD-02's exception rule never fires on real data |
| Nodes without a placement | **0** | No geometry to invent |
| Layouts | 1 (`layout-default`, manual) shared by all 17 | Confirms the diagnosis |
| Route hints / collapsed / subjectRef / expandsTo | 0 / 0 / 0 / 0 | Built but never used — worth telling Chris |
| Interfaces / distinct owners | 56 / 51 | Supports LBD-05 (interfaces as ports) |
| Applied operations | 60 | Idempotency history to carry forward |

### D-006 — "Before" baseline, driven in a real browser (not read from code)

Screenshots: `~/.claude/browse/shots/canvas-before.png`, `canvas-edit-mode.png`. Chris's rule —
UI is never judged from source. What I found using it the way he would:

| # | What a user hits | Severity |
|---|---|---|
| 1 | **The toolbar clips.** In Edit the title runs off the right edge (`Novakai project model r238…` cut mid-token) and the diagram select truncates to `Diagram…`. The controls collide with the Inspect panel instead of fitting beside it. | High — it reads as broken |
| 2 | **Inspect is a ~400px void.** 95% empty with one grey line of copy in the middle. It's the largest area on screen and says the least. | High — R1 friendliness |
| 3 | **Present is the default mode.** The app opens read-only; every authoring control is one click away behind a mode toggle. For a tool whose first requirement is "create diagrams on the canvas", the drawing tools should not be the hidden state. | High — R1 |
| 4 | **Node text truncates mid-word** — `listAgents(Pr…`, `SessionStatus { provider,`. Interfaces and types are the content, and they're the first thing cut. | Medium |
| 5 | **Legend floats over the canvas** as a bordered box, permanently, regardless of relevance. Ornament that never earns its place. | Medium — his "no ornament" rule |
| 6 | `Preview map layout` wraps to two lines inside its button; `Undo` sits disabled and unexplained. | Low |
| 7 | The React Flow attribution badge sits in the corner of the product. | Low |

**Correction to my own earlier reading:** Present and Edit differ visibly in these screenshots,
but that is zoom and label styling, not arrangement — `presentArchitecture` already delegates
to the same focus path, so Codex did fix the contradiction at the data level. What survives is
the *concept*: a mode still exists in the presentation layer and could regress. V2 removes the
possibility structurally rather than trusting it.

## Slice progress

| Stage | State | Evidence |
|---|---|---|
| Pass 1 blueprint | done | `docs/blueprint/2026-08-06-canvas-capability-blueprint.md` |
| Ratification round 1 | **failed**, 11 SEVERE | fixed at source in Revision 2 |
| Revision 2 + Pass 2 contract | done | `docs/blueprint/2026-08-06-canvas-blueprint-r2.md` |
| Ratification round 2 | **failed**, 7 SEVERE — narrow | fixed in Revision 2.1 and in code |
| W1 migration + records | done | 3 real files migrate losslessly; 37 tests |
| W1 workspace + library | done | 68 tests; atomicity, conflict, idempotency, undo, CAS |
| W1 storage adapter | next | file-per-diagram + index |
| W1 host rewiring | **not started** — see the decision below | |
| W2–W8 | not started | |

### D-007 — What I chose NOT to do tonight, and why

The capability is complete and proven, but **the running app has not been moved onto it**. That
was a deliberate call around 02:50, not an accident of running out of time.

Rewiring the host means 10 presentation files plus 11 CLI files, and `./canvas apply` currently
resolves wire endpoints by label across the whole document — which cannot work once a record is
one diagram. Starting that with four hours left risks Chris waking to an app that opens to an
error, with the CLI broken too. A half-migrated tree that can be authored from neither surface
is strictly worse than an unmigrated one.

So: the record capability is committed, tested against all three of his real files, and unused.
The app still runs on the existing path. The remaining hours went to UI craft — which lives in
CSS and layout and survives the swap whenever it happens.

**This is the honest state: foundation proven, not yet load-bearing.**

## Final measurements

| Gate | Baseline | Now |
|---|---|---|
| Tests | 158 pass / 3 fail | **226 pass / 3 fail** — same three pre-existing reporting failures, untouched |
| Typecheck (both configs) | clean | clean |
| Lint | clean | clean |
| Production build | clean | clean |
| Analytics, repo-wide | 65/100 | **66/100** — ratchet holds, no new red |

Per-dimension movement: complexity 45.7 → 41.7 debt/1k, docCoverage 51% → 58.6%,
interfaceClarity red → amber (I pushed it red by putting one function in a file of ten type
exports; moving `asId` out restored it). `deadExports` worsened, 21.1% → 26.4%, and that one is
**mine and honest**: publishing the capability on `src/canvas.ts` adds exports nothing in-repo
imports, because no host is wired to them yet. The analytics caveat says the same thing. It
resolves when the host moves; I am not going to hide it by un-publishing the surface.

**On the ≥86 target:** not claimed and not met. The repo-wide number cannot exceed 79 while any
red stands, and all three reds — complexity, giant files, dead exports — are dominated by the
work-session-reporting experiment I was told to leave alone. My own files carry none of it: zero
files over 400 lines, zero functions over 60, zero swallowed errors, every export documented.
I have not produced a Canvas-scoped score, because scoping a measurement to flatter a result is
exactly the move the honesty rules forbid.

### D-008 — The worst bug I found was not in the new code

`load()` caught every error and returned the empty-document fallback. A corrupt file, a failed
request, or a schema mismatch opened a blank canvas — and the autosave a few seconds later
wrote that blank canvas over the real file. I proved it by corrupting one node kind in the real
data and loading the app.

Fixed: a missing document is still a legitimate empty start; a document that exists and cannot
be read now throws, and the host refuses to open rather than starting on emptiness it would
then persist. Both paths driven in a browser.

This is why the failure-state work belonged in the slice that touches data, exactly as the
second audit argued.

## What the next session should pick up

1. **Wire a host onto the records.** The file-per-diagram adapter
   (`public/data/library.json` + `public/data/diagrams/<id>.json`), then the web host, then the
   CLI — in one slice, deleting the old path as it goes. `./canvas apply` resolves wire
   endpoints by label across the whole document today and must become per-record.
2. **W6's failure states**, which the second audit rightly said should not wait: the swallowed
   `load()` in `http-json-repository.ts` still returns an empty document on any error.
3. `CanvasView.hiddenKinds`, extra layouts/views, and route-hint waypoints are settled format
   with no command yet — W2 and W4 own them.

## Standing questions for Chris

- **The three orphan notes** now land in an "Unfiled" diagram. Were they meant to be inside
  `project-scope`, `messaging-scope` and `browser-scope`? Say the word and the migration puts
  them there instead.
- **The cross-diagram wire** (`Agent session` —"is a"→ `Agent PTYs`) became a library link. If
  those two boxes are really the same thing seen twice, a subject link is the better model —
  but that is a claim about your system, not one I should make for you.
- **Your uncommitted working file** holds nine nodes you moved by hand that exist nowhere else.
  Worth committing.
- **The React Flow attribution badge** sits in the corner. Hiding it is a licensing question,
  so I left it alone.
