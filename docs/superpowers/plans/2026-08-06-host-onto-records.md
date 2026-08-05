# Plan — move the running app onto independent diagram records

> **Status:** Builder plan, not law. Author: Claude (Anthropic), 2026-08-06.
> Branch `claude/canvas-record-model`. Executes the slice deliberately left unfinished
> overnight (see `BUILD-LOG.md` D-007): the record capability is proven and unused; the app
> still runs on the old single-document path.

## Context

`src/canvas.ts` already publishes a working capability: `createCanvasLibrary`,
`createCanvasWorkspace`, `migrateDocumentToLibrary`, and an in-memory repository, proven by 226
passing tests including a second-host integration and a losslessness census over three real
data files. What does not exist is any durable storage for records, and any host that uses them.

The old path is `ArchitectureDocument` — one document holding all 17 diagrams, one global
layout, referenced by 38 files. It is what the browser and `./canvas` still read and write.

## Global Constraints

Binding on every task. Reviewers get these verbatim.

1. **Layer purity.** `src/domain/**` and `src/application/**` must not import `react`,
   `react-dom`, `@xyflow/react`, `node:fs`, `node:path`, or call `fetch`. Enforced by
   `src/second-host.test.ts`; it must keep passing.
2. **Hosts use the public path.** `src/presentation/**` and `tools/**` reach the capability
   through `src/canvas.ts`, not through `src/domain/**` or `src/application/**`.
3. **Per-record compare-and-swap.** Every record write carries the revision it expects and
   returns `written | stale-revision | save-failed`. The index carries its own revision.
   `LibraryIndex.entries` is a derived projection, rebuildable from records; `links` and
   `migratedOperations` are authoritative.
4. **Migration is one-way and lossless.** Running it over any of the three fixtures in
   `src/domain/migrate/fixtures/` must leave `censusOfLegacyDocument` and
   `censusOfMigratedLibrary` equal on nodes, node signatures, wires + links, interfaces, types,
   placements, and operation IDs. Never widen the census to make a diff pass.
5. **No silent failure.** No empty `catch`. A load error must never be reported as an empty
   document — that is the bug fixed in commit `d8ab2e0`, and it must not return.
6. **Test baseline.** Exactly three tests may fail: the pre-existing work-session-report
   publication failures. `src/capabilities/work-session-reporting/**`, `tools/report-session/**`
   and `src/presentation/work-session-report/**` are out of scope — do not modify them.
7. **Quality gates.** `npx tsc -b`, `npx tsc -p tsconfig.tools.json --noEmit`, `npx oxlint`, and
   `npx vite build` must all pass clean. Every exported declaration carries a comment directly
   above it (no blank line between).
8. **Chris's data is irreplaceable.** Never write to `~/Programming/Novakai-Canvas/public/data/`
   or `~/Programming/Novakai-Canvas-codex-product-decisions/`. Work only inside this worktree.

## Task 1: File-per-diagram repository adapter

Create `src/adapters/file-library-repository.ts` exporting `createFileLibraryRepository`, an
implementation of `CanvasLibraryRepository` (defined in `src/application/canvas-library.ts`)
that talks to HTTP endpoints.

Endpoints it must use, given a base of `/api`:
- `GET/PUT /api/library` — the `LibraryIndex`
- `GET/PUT /api/diagrams/<diagramId>` — one `DiagramRecord`
- `DELETE /api/diagrams/<diagramId>`
- `GET /api/diagrams` — array of diagram IDs, for `listDiagramIds()`

Requirements:
- `writeDiagram(record, expectedRevision)` sends the expected revision and maps HTTP `409` to
  `{ status: 'stale-revision', actualRevision }` (read the actual revision from the 409 response
  body, shape `{ revision: number }`), any other non-2xx to
  `{ status: 'save-failed', reason }`, and 2xx to `{ status: 'written', revision }`.
- `writeIndex(index, expectedRevision)` behaves the same way.
- `readIndex()` and `readDiagram(id)` parse from `unknown` and throw a typed error on invalid
  content — reuse `CanvasLoadError` from `src/adapters/http-json-repository.ts`. A 404 from
  `readDiagram` throws; a 404 from `readIndex` is NOT special-cased here (Task 2 owns the
  bootstrap decision).
- Add runtime parsing: a zod schema for `DiagramRecord` and `LibraryIndex` in
  `src/domain/record-schema.ts`, exporting `diagramRecordSchema` and `libraryIndexSchema` with
  a `parse(input: unknown)` shape matching `architectureDocumentSchema`. External JSON must not
  reach the domain unparsed.

Tests (`src/adapters/file-library-repository.test.ts`), using `vi.stubGlobal('fetch', …)`:
- round-trips an index and a record
- maps 409 to `stale-revision` carrying the actual revision
- maps 500 to `save-failed`
- throws `CanvasLoadError` on unparseable content
- `listDiagramIds()` returns the served IDs

Also add a round-trip test proving a migrated record survives
`diagramRecordSchema.parse(JSON.parse(JSON.stringify(record)))` unchanged, for every record
produced from the `real-v2-working-copy.json` fixture.

**Exit:** new tests pass; full suite still 3 failures; tsc, lint, build clean.

## Task 2: Dev bridge serves the record layout

Rewrite `tools/json-file-bridge.ts` so the Vite dev server serves the endpoints Task 1 expects,
on disk as:
- `public/data/library.json` — the index
- `public/data/diagrams/<diagramId>.json` — one record each

Requirements:
- Preserve the existing behaviour for `/api/preferences` (`public/data/canvas-preferences.json`)
  unchanged, including its revision check if it has one.
- Compare-and-swap: a PUT carrying an expected revision that does not match what is on disk
  returns `409` with body `{ "revision": <actual> }`. A PUT for a file that does not exist yet
  succeeds when the expected revision is `0`.
- **Bootstrap migration, once:** on `GET /api/library` when `public/data/library.json` does not
  exist and `public/data/project-architecture.json` does, read the legacy file, run
  `parseArchitectureDocument` then `migrateDocumentToLibrary`, write `library.json` and every
  `diagrams/<id>.json`, and rename the legacy file to `project-architecture.pre-v3.json` so the
  migration cannot run twice and the original is still on disk. Log one line naming the report's
  counts (diagrams created, unfiled nodes, cross-diagram links, carried operations).
- Keep the existing `novakai:data-changed` hot notification working when any served file is
  written by something other than the browser.
- The bridge is a Node/Vite plugin: `node:fs` is expected and correct here.

Tests (`tools/json-file-bridge.test.ts`) against a temp directory:
- migration runs on first library read and renames the legacy file
- migration does not run twice
- PUT with a stale expected revision returns 409 with the actual revision
- PUT with matching revision writes the file

**Exit:** tests pass; `npm run dev` serves a migrated library from the real committed data;
tsc/lint/build clean.

## Task 3: Read model — project a record for rendering

Add `projectView(record, viewId?)` to the domain, exported from `src/canvas.ts`, returning what
a renderer needs from one record without the renderer re-deriving policy:

```ts
interface ProjectedView {
  nodes: PositionedNode[];   // semantic node joined with its placement in the active layout
  wires: CanvasWire[];       // wires whose both endpoints are visible
  viewport: { x: number; y: number; zoom: number };
  collapsedNodeIds: NodeId[];
}
```

Requirements:
- Collapse policy lives here, once: a collapsed group's descendants are excluded from `nodes`,
  and any wire with a hidden endpoint is excluded from `wires`. This is the behaviour
  `focusArchitecture` implements today in `src/domain/maps.ts` — read it, keep the behaviour.
- `hiddenKinds` on the view excludes nodes of those kinds and their attached wires.
- Pure: no I/O, no framework types, deterministic, no clock.
- Nodes are returned parent-first, so a renderer that requires parents before children (React
  Flow does) can consume the array directly. `src/presentation/projection.ts` has
  `sortParentFirst` — that ordering logic belongs in the domain now.

Tests (`src/domain/project-view.test.ts`) driven from real migrated records:
- every returned node has geometry
- collapsing a group hides its descendants and their wires, and restores them when uncollapsed
- a hidden kind removes its nodes and their wires
- parents always precede their children
- two calls with the same input return deep-equal output

**Exit:** tests pass; suite still 3 failures; tsc/lint/build clean.

## Task 4: Web host renders from records

Move the browser app onto the library and workspace.

Requirements:
- `src/main.tsx` composes: `createFileLibraryRepository` → `readIndex()` →
  `createCanvasLibrary(...)` → open the first active diagram → render. Keep the existing
  `LoadFailure` behaviour: if the library or the opened record cannot be read, render
  `LoadFailure` and write nothing.
- `src/App.tsx` holds a `CanvasWorkspace` for the open diagram and a `CanvasLibrary` for the
  picker. Switching diagrams opens another workspace through the library.
- Rendering consumes `projectView` from Task 3. `src/presentation/projection.ts` maps the
  projected view to React Flow nodes/edges; it must no longer call `focusArchitecture`,
  `presentArchitecture`, `positionedNodes`, or touch `ArchitectureDocument`.
- Every mutation goes through `workspace.execute(...)` / `workspace.submit(...)`. The
  actor context is `{ actor: { id: 'local-user', kind: 'human' }, provenance: { source: 'ui' } }`.
- Autosave calls `library.save(diagramId)`. On `stale-revision` show the existing
  "File changed on disk — your edits are unsaved" status and keep the edits. On `save-failed`
  show "Not saved". Never discard local work.
- Present/Edit remains chrome only: both modes render the same `projectView` output.
- The inspector's contents list (`DiagramContents`) reads from the projected view.
- Preferences continue to load and save exactly as they do now.

Tests: update existing presentation tests to drive records. Do not delete a test to make it
pass — if a test's premise no longer exists, say so in the report rather than removing it
silently.

**Browser verification is required and is part of this task, not optional.** Run the dev server
and drive it with `node ~/.claude/browse/browse.mjs`: load the app, screenshot, switch Present
and Edit, open a different diagram from the picker, select a node from the canvas, select a node
from the contents list, add a node via `+ Add`, and confirm the save status reaches "Saved".
Report what each screenshot showed. Passing tests are not evidence the UI works.

**Exit:** app loads Chris's 17 diagrams from records in a real browser, every listed interaction
verified with screenshots, suite still 3 failures, tsc/lint/build clean.

## Task 5: CLI authors through the library

Move `tools/canvas-cli/` onto the record capability.

Requirements:
- `./canvas maps`, `read`, `apply`, `rm`, `snapshot` keep their current command-line surface and
  DSL grammar. `AGENTS.md` documents them; behaviour visible to an agent must not change except
  where noted below.
- `apply` writes one diagram record per scope block, through the library, as one change set with
  `provenance: { source: 'cli' }` and an operation ID.
- `tools/canvas-cli/compile.ts` currently resolves wire endpoints by label across the whole
  document. Per-record, endpoints resolve within the diagram being applied. A wire naming a node
  in another diagram becomes a `CrossDiagramLink` via `library.addLink(...)` rather than an
  error — the real data has exactly one such relationship, and it must survive a re-apply.
- Interface IDs are minted from slugified labels and regenerated on every apply
  (`compile.ts:139`). Keep that behaviour for now — changing it is a separate decision recorded
  in the blueprint — but note in the report every place it forced a compromise.
- `rm <map>` removes a record through `library.remove(...)`, honouring the inbound-link refusal.

Tests: keep `tools/canvas-cli/*.test.ts` green, adapting them to records. Add a test proving a
re-applied scope preserves node IDs and placements for unchanged nodes.

**Exit:** `./canvas maps`, `./canvas read <map>`, `./canvas apply` and `./canvas snapshot` all
work against the migrated data in this worktree, demonstrated by running them; suite still 3
failures; tsc/lint/build clean.

## Task 6: Delete the superseded path

Remove the old single-document path now that nothing uses it.

Requirements:
- Delete `focusArchitecture`, `presentArchitecture`, and anything left in `src/domain/maps.ts`
  that no longer has a caller; delete `src/application/canvas-engine.ts`,
  `src/application/json-repository.ts`, `src/domain/layouts.ts`, and `ArchitectureDocument` and
  its commands from `src/domain/model.ts` — **only** those with no remaining caller.
- `parseArchitectureDocument` and the v1→v2 migration in `src/domain/schema.ts` must SURVIVE:
  they are the entry point of the v1/v2 → v3 chain. Keep only what the migration needs.
- Update `src/canvas.ts` to publish only the record capability.
- Update `AGENTS.md` and `README.md` where they describe the old storage layout.
- Run `npx tsc -b` and the suite after each deletion; a deletion that breaks something means
  that thing still has a caller.

**Exit:** no reference to `ArchitectureDocument` outside `src/domain/schema.ts` and
`src/domain/migrate/**`; suite still 3 failures; tsc/lint/build clean; repo-wide
`novakai-analytics` score not below 65.
