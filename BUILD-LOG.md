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

Taken: attach each to the diagram its ID and content plainly indicate (→ `project-scope`,
`messaging-scope`, `browser-scope`) and list every reassignment in the migration report, rather
than dropping them or inventing an "unfiled" junk diagram.
**ASSUMPTION:** these were meant to be inside those diagrams and lost their parent. Falsified
if Chris says they were intentionally global — then they need a home concept of their own.

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

## Slice progress

| Slice | State | Evidence |
|---|---|---|
| Pass 1 blueprint | written | `docs/blueprint/2026-08-06-canvas-capability-blueprint.md` |
| Ratification | running | fresh zero-context reviewer |
| V1 Records | not started | |
| V2 Arrangement | not started | |
| V3 Slice layout | not started | |
| V4 Ports & wires | not started | |
| V5 Library | not started | |
| V6 Agent authoring | not started | |
| V7 Second host | not started | |
| V8 Craft pass | not started | |
