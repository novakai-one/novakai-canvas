# Canvas CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A five-verb CLI (`./canvas maps|read|apply|rm|snapshot`) that lets any agent author an architecture map from a terse DSL — zero geometry, valid by construction, one turn — plus live reload in the running app.

**Architecture:** A new `tools/canvas-cli/` package (plain TS, run natively by Node ≥ 24 type-stripping) parses a line-oriented DSL into an AST, compiles it into the existing zod-validated `ArchitectureDocument` (upsert-by-scope semantics), runs deterministic auto-layout via `@dagrejs/dagre`, and writes `public/data/project-architecture.json`. The vite bridge gains a guarded file-watch that pushes a custom HMR event so the open app soft-reloads via `engine.replace()`. `read` prints the DSL back (round-trippable); `snapshot` renders a dependency-free SVG.

**Tech Stack:** Node 24 native TS execution, zod (existing), `@dagrejs/dagre` (new devDependency), vitest (existing), vite custom HMR events.

## Global Constraints

- The CLI must run as `./canvas <verb>` from the repo root with **no build step** (`node tools/canvas-cli/cli.ts` under Node ≥ 24; imports inside `tools/canvas-cli` use explicit `.ts` extensions — Node type-stripping does not resolve extensionless paths).
- Agents never write coordinates: every `apply` re-layouts the touched scopes. Untouched scopes keep their positions.
- Every written document must pass `architectureDocumentSchema` (import from `src/domain/schema.ts`) **before** hitting disk; `revision` increments by 1 per write; file ends with `\n`, 2-space indent (matches the bridge's format).
- Validation reports **all** errors at once, each with a fix hint; exit code 1, errors to stderr.
- Wire declarations **require a contract** (`: label` part) — a wire without one is a validation error ("wire needs a contract, e.g. `wire A -> B : acquire(AgentId) -> SessionHandle`").
- IDs are derived from labels (slugs); agents never see or invent ids.
- No new runtime dependency other than `@dagrejs/dagre`.
- All existing tests keep passing; `npm run check` green at the end.
- Existing document content not named by the DSL is never modified or deleted; **untouched top-level nodes never move**.
- **Type-only imports MUST use `import type`** (`model.ts` exports only types — a value import crashes under Node type-stripping). Add `tsconfig.tools.json` covering `tools/**` and reference it from `npm run check` so `verbatimModuleSyntax` enforces this (tools are currently in NO tsconfig — `tsc -b` never sees them).
- Writes are atomic (write temp file in same dir + `rename`); any `fs.watch` therefore watches the **directory**, not the file.
- **Stable ids on re-apply:** when a re-applied scope contains a node whose slug matches an existing child of the old scope, reuse the existing node id. Cross-scope wires whose endpoint was replaced by a same-slug node are re-pointed, never dropped. (Real case in the data: wire `session-agents` crosses project-scope → messaging-scope.)

---

## The DSL (single source of truth for grammar)

```
# comment line (ignored)
scope "Agent Browser Sessions"
  note "One session per instance; renders off-screen."
  module "Session broker" "Owns leases and allocation"
    acquire(AgentId) -> SessionHandle
    release(SessionId) -> void
    type SessionHandle { sessionId, cdpEndpoint }
  runtime "Chrome instances"
  resource "sessions.json"
  wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]
```

Rules:
- Line-oriented. Indentation is cosmetic; structure comes from statement kinds: a node statement (`module|object|runtime|resource|comment`-alias-`note`) attaches to the **current scope**; an interface line or `type` line attaches to the **current node**; `wire` attaches to the current scope (label lookup is doc-wide, preferring the current scope).
- Names: bare single tokens (`SessionBroker`) or double-quoted strings (`"Session broker"`). Second quoted string after a node's name = its `description`.
- Interface line: `name(TypeA, TypeB) -> TypeC` — accepts/returns are bare type names, comma-separated; `-> void` allowed; multiple returns comma-separated.
- Type line: `type Name { fieldA, fieldB }`.
- Wire: `wire <sourceName> -> <targetName> : <contract> [kind]` — `[kind]` optional, one of `owns|references|assigns|queries|executes`, default `references`.
- `note "text"` inside a scope creates a `comment` node child of that scope.
- Multiple `scope` blocks per file allowed.

**Apply semantics (declarative, scope-granular upsert):** for each `scope` block, find an existing top-level scope whose `slug(label)` matches; if found, delete that scope node, all its descendants, their interfaces/types, and every wire touching any deleted node — then insert the freshly compiled scope. If not found, append as a new scope stacked below the lowest existing top-level node. Content outside the named scopes is untouched.

---

### Task 1: Slugs + DSL parser

**Files:**
- Create: `tools/canvas-cli/slug.ts`
- Create: `tools/canvas-cli/dsl-parse.ts`
- Test: `tools/canvas-cli/dsl-parse.test.ts`

**Interfaces:**
- Produces: `slugify(label: string): string` — lowercase, alnum runs joined by `-`, e.g. `"Session broker"` → `session-broker`.
- Produces: `parseDsl(source: string): { scopes: ScopeAst[]; errors: ParseError[] }` where

```ts
export interface ParseError { line: number; message: string; hint: string }
export interface InterfaceAst { name: string; accepts: string[]; returns: string[] }
export interface TypeAst { name: string; fields: string[] }
export interface NodeAst {
  kind: 'module' | 'object' | 'runtime' | 'resource' | 'comment';
  label: string; description?: string;
  interfaces: InterfaceAst[]; types: TypeAst[];
}
export interface WireAst {
  source: string; target: string; contract: string;
  kind: 'owns' | 'references' | 'assigns' | 'queries' | 'executes'; line: number;
}
export interface ScopeAst { label: string; description?: string; nodes: NodeAst[]; wires: WireAst[] }
```

- Parser collects **all** errors (never throws): interface/type/wire line before any node/scope, unknown statement, wire missing `: contract`, bad wire kind, unbalanced quotes/parens.
- `note "x"` is sugar for a `comment` node with `label: x`.

- [ ] **Step 1: Write failing tests** — cover: full example from the grammar section parses into the expected AST; `slugify("Session broker") === 'session-broker'`; wire without contract yields error containing "needs a contract" and hint showing an example; interface line outside a node yields error with line number; unknown keyword yields error listing valid statements; `-> void` parses to `returns: ['void']`; unquoted single-token names work; multiple scopes in one source.
- [ ] **Step 2: Run** `npx vitest run tools/canvas-cli/dsl-parse.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `slug.ts` and `dsl-parse.ts`. Tokenize each trimmed line; dispatch on first token (`scope|module|object|runtime|resource|note|type|wire|#`); anything containing `(` and `->` on a line while a node is current = interface line. Track `currentScope`/`currentNode` state.
- [ ] **Step 4: Run tests** — expect PASS.
- [ ] **Step 5: Commit** `feat(cli): DSL parser with all-errors-at-once reporting`

### Task 2: Compiler (AST + existing document → new document)

**Files:**
- Create: `tools/canvas-cli/compile.ts`
- Test: `tools/canvas-cli/compile.test.ts`

**Interfaces:**
- Consumes: `ScopeAst`, `slugify` from Task 1; `ArchitectureDocument` type from `src/domain/model.ts`.
- Produces: `compile(doc: ArchitectureDocument, scopes: ScopeAst[]): { doc: ArchitectureDocument; errors: CompileError[]; touchedScopeIds: string[] }` — pure, no I/O, no layout (positions/sizes zeroed as `{x:0,y:0}` / `{width:1,height:1}` placeholders; Task 3 fills them).
- ID scheme: scope id = `slug(scopeLabel)`; child id = `slug(scopeLabel)--slug(nodeLabel)`; interface id = `<nodeId>--if-<slug(name)>`; type id = `<nodeId>--type-<slug(name)>`; wire id = `<scopeId>--wire-<n>`. **Exception (stability):** when replacing an existing scope, a new node whose `slug(label)` matches an old child's `slug(label)` reuses the old child's id verbatim; the scope node itself likewise keeps its existing id (e.g. `browser-scope` stays `browser-scope` even though `slug("Agent Browser Sessions")` differs).
- Upsert: match existing top-level scope by `slugify(existing.label) === slugify(ast.label)`; delete it + descendants + their interfaces/types + wires **internal to the scope**; insert compiled scope. Wires from OTHER scopes that touch a removed node: if the new scope has a same-slug replacement, re-point them (id reuse makes this automatic); only if no replacement exists are they dropped, and each drop is reported on stderr as `dropped cross-scope wire: <label>`.
- Wire endpoint resolution: by `slugify(label)` among the new scope's nodes first, then all doc nodes; unresolved endpoint = CompileError naming the label and listing the 5 closest candidates.
- Duplicate node labels within one scope = CompileError.
- `revision` untouched here (document-io owns it).

- [ ] **Step 1: Write failing tests** — compile example scope into empty-ish doc (build a minimal valid doc fixture inline): assert node ids, parentId wiring, interfaces attached via `interfaceIds`, wire kind default `references`, contract stored as wire `label`; re-applying a scope with same label replaces old children with no orphan interfaces/wires; **id stability**: re-applied scope keeps its original scope id, and a child whose slug matches an old child reuses the old id verbatim (fixture uses old-style bare ids like `planning`); **cross-scope wire survival**: a wire from another scope into a re-applied node still resolves after re-apply (same id), and a wire into a node that truly disappeared is dropped WITH a stderr report; unresolved wire target errors with candidate list; cross-scope wire resolves doc-wide; other scopes' nodes byte-identical after compile.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** `compile.ts`.
- [ ] **Step 4: Run tests** — expect PASS.
- [ ] **Step 5: Commit** `feat(cli): scope-granular declarative compiler`

### Task 3: Auto-layout

**Files:**
- Create: `tools/canvas-cli/layout.ts`
- Test: `tools/canvas-cli/layout.test.ts`
- Modify: `package.json` (add `"@dagrejs/dagre": "^1.1.4"` to devDependencies)

**Interfaces:**
- Consumes: `ArchitectureDocument`; `touchedScopeIds` from Task 2.
- Produces: `layoutScopes(doc: ArchitectureDocument, scopeIds: string[]): ArchitectureDocument` — for each named scope: estimate child sizes from content, dagre `TB` layout (`nodesep: 40, ranksep: 70`) using intra-scope wires as edges, child positions **relative to parent**, scope sized to bounding box + padding (56 top for title, 40 sides/bottom).
- **Scope placement:** a re-applied existing scope keeps its existing top-left position and grows/shrinks in place. A brand-new scope is placed at `x = 40`, `y = (bottom of lowest existing top-level node) + 80`. **Untouched top-level nodes are never moved** (Chris hand-arranged them). If a regrown scope now overlaps a neighbour, print a warning to stderr (`scope <label> now overlaps <label>; drag or re-apply the neighbour`) — do not move the neighbour.
- Size heuristics (calibrated against the three real hand-sized cards — `planning` 132px w/ 1 iface + desc, `threads` 150px w/ 2 ifaces + desc, `task-assignment` 112px desc-only; cards render at STORED size with `overflow:hidden`, so under-estimating clips content — always bias generous): node width `clamp(200, 24 + 7.2 * longestLine, 420)`; node height `= 48 + descriptionBlock + 26 * interfaceCount + 24 * typeCount + 16` where `descriptionBlock = description ? 24 + 16 * ceil(description.length / max(30, width/7.2)) : 0`; comment nodes width 280, height `= 48 + 21 * ceil(chars / 34)` (Georgia 14px/1.5).
- Deterministic: same input → same output (no randomness; dagre is deterministic for fixed insertion order — insert **nodes AND edges** sorted by id).

- [ ] **Step 1:** `npm install -D @dagrejs/dagre` (also add `@types` shim if needed: dagre ships types).
- [ ] **Step 2: Write failing tests** — layout a compiled 6-node scope: no two sibling rects intersect (write an `intersects()` helper in the test); every child fits inside its scope rect; wire-connected nodes ordered source-above-target (y increases along `browse CLI → Session broker`); calling twice yields identical positions; a re-applied scope keeps its prior top-left position; untouched scopes' positions byte-identical; a new scope lands below the lowest existing top-level node; estimated node height ≥ real hand-sized equivalents (assert the heuristic on a desc+2-iface card gives ≥ 150).
- [ ] **Step 3: Run** — expect FAIL.
- [ ] **Step 4: Implement** `layout.ts`.
- [ ] **Step 5: Run tests** — expect PASS.
- [ ] **Step 6: Commit** `feat(cli): deterministic dagre auto-layout, zero agent geometry`

### Task 4: Outline printer (`read`)

**Files:**
- Create: `tools/canvas-cli/dsl-print.ts`
- Test: `tools/canvas-cli/dsl-print.test.ts`

**Interfaces:**
- Consumes: `ArchitectureDocument`; `parseDsl` (for the round-trip test).
- Produces: `printScope(doc: ArchitectureDocument, scopeId: string): string` and `printOutline(doc: ArchitectureDocument): string` (all scopes). Output is valid DSL: quoted labels, node descriptions, interface lines `name(accepts) -> returns`, `type Name { fields }`, wires with `[kind]`, `note` for comment children.
- Produces: `listMaps(doc: ArchitectureDocument): { id: string; label: string; nodes: number; wires: number }[]` (top-level scopes only).

- [ ] **Step 1: Write failing tests** — **round-trip**: `compile(parse(printScope(doc, id)))` reproduces the same nodes/interfaces/types/wires for a fixture scope (compare structurally, ignoring position/size); wires print their contract and non-default kind; `listMaps` counts only descendants of each scope.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** `dsl-print.ts`.
- [ ] **Step 4: Run tests** — expect PASS.
- [ ] **Step 5: Commit** `feat(cli): read prints round-trippable outline DSL`

### Task 5: document-io + CLI entry + `./canvas` shim + help

**Files:**
- Create: `tools/canvas-cli/document-io.ts`
- Create: `tools/canvas-cli/cli.ts`
- Create: `canvas` (repo root, `chmod +x`)
- Modify: `package.json` (script `"canvas": "node tools/canvas-cli/cli.ts"`)
- Test: `tools/canvas-cli/cli.test.ts` (integration via `node:child_process.execFile` against a temp copy of the data file using `--file`)

**Interfaces:**
- Consumes: everything from Tasks 1–4; `architectureDocumentSchema` from `src/domain/schema.ts`.
- Produces: `loadDocument(path: string)`, `saveDocument(path: string, doc)` (validates with zod, bumps `revision` by 1, writes 2-space JSON + trailing `\n`, **atomically**: temp file in same dir + `rename`).
- Also create `tsconfig.tools.json` (extends the app config's strict settings, `include: ["tools"]`, `noEmit`) and add it to the `check` script (`tsc -p tsconfig.tools.json`) so `verbatimModuleSyntax` catches value-imports of type-only modules — the CLI crashes at runtime otherwise (Node strip-types).
- CLI verbs (default file `public/data/project-architecture.json` resolved from the CLI's own location, overridable with `--file <path>`):
  - `canvas maps` — table: `id  label  nodes  wires`.
  - `canvas read <map>` / `canvas read` — outline DSL to stdout (`<map>` matches scope id or slug of label).
  - `canvas apply [dslFile]` — reads file or stdin; parse → compile → layout → save. On success prints `applied: <scope labels> (revision N)`. On any parse/compile error prints ALL errors then exits 1 without writing.
  - `canvas rm <map> <name>` / `canvas rm <map>` — remove one node (and its interfaces/types/wires) or a whole scope; relayouts.
  - `canvas snapshot <map> [-o out.svg]` — Task 6; before Task 6 lands, prints "snapshot: not yet implemented" exit 1.
  - `canvas help` / `--help` / no args / unknown verb — prints the verb list AND the full DSL grammar block from this plan (~25 lines), so a zero-context agent can self-teach from one command.
- `./canvas` shim: `#!/bin/sh\nexec node "$(dirname "$0")/tools/canvas-cli/cli.ts" "$@"`.

- [ ] **Step 1: Write failing integration tests** — copy the real `public/data/project-architecture.json` to a temp dir; run `canvas maps` (expect 3 known scopes); `canvas apply` a new demo scope from a fixture DSL string via stdin (expect exit 0, revision bumped, scope present in file, zod-valid); `canvas read demo-scope` returns DSL containing the interface line; `canvas apply` with a broken DSL (wire w/o contract + unknown keyword) exits 1, prints BOTH errors, file unchanged; `canvas rm` removes the scope and its wires; `canvas help` output contains `scope "` and every verb name.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** `document-io.ts` + `cli.ts` + shim + package.json script.
- [ ] **Step 4: Run tests** — expect PASS. Also run `./canvas help` manually from repo root — expect grammar printed.
- [ ] **Step 5: Commit** `feat(cli): five-verb canvas CLI with self-teaching help`

### Task 6: SVG snapshot

**Files:**
- Create: `tools/canvas-cli/snapshot.ts`
- Modify: `tools/canvas-cli/cli.ts` (wire the verb)
- Test: `tools/canvas-cli/snapshot.test.ts`

**Interfaces:**
- Consumes: `ArchitectureDocument`.
- Produces: `renderScopeSvg(doc: ArchitectureDocument, scopeId: string): string` — self-contained SVG: dark bg `#0d0d0f`, scope panel `#1b1b1e` with gold `#d0a14b` title, node cards `#252529` with label (ink `#ececee`), kind tag (muted `#a2a2aa`, 10px), interface lines `name(accepts) → returns` (12px mono is allowed here — it's terminal-ish output, but use Inter/sans per brand: use `font-family="Inter, sans-serif"`), wires as 3-segment elbow polylines `#8b8b94` with contract label at midpoint, arrowhead marker.
- CLI: `canvas snapshot <map>` writes `<map>.svg` to cwd or `-o` path, prints the path.

- [ ] **Step 1: Write failing tests** — SVG string contains: scope label text, every child node label, every interface signature, every wire contract; all node rects lie inside the scope rect; output starts `<svg` and parses as XML (use a regex-free check: balanced by attempting `DOMParser`? Not in node — instead assert no unescaped `&` and count `<rect`/`</svg>`); ampersands and `<` in labels are XML-escaped.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** `snapshot.ts`, wire verb.
- [ ] **Step 4: Run tests** — expect PASS. Manually: `./canvas snapshot browser-scope -o /tmp/browser.svg` and open in browser to eyeball.
- [ ] **Step 5: Commit** `feat(cli): dependency-free SVG snapshot`

### Task 7: Live reload + docs (README fix + AGENTS.md contract)

**Files:**
- Modify: `tools/json-file-bridge.ts`
- Modify: `src/App.tsx` (or wherever the engine is constructed — locate `createCanvasEngine` call; add the HMR listener beside it)
- Modify: `README.md` (`127.0.0.1` → `localhost`, add CLI section)
- Create: `AGENTS.md` (repo root)

**Interfaces:**
- Bridge: keep `watcher.unwatch` (prevents vite's default full-reload), add `fs.watch` on the `public/data` **directory** (atomic renames break per-file watches), debounce 200ms; **suppress events within 500ms after a bridge PUT** (reload-loop guard — track `lastBridgeWrite` timestamp); on external change: `server.ws.send({ type: 'custom', event: 'novakai:data-changed', data: { path } })`.
- **Bridge PUT gains revision compare-and-swap** (the write race is real: user drags at T0 → autosave PUT in flight at T500 → CLI writes at T510 → stale PUT lands at T520 and silently destroys the CLI's apply). On PUT to `/api/architecture`: parse body, read on-disk doc, if `body.revision <= disk.revision` respond **409** with `{ error: 'stale revision', disk: N }` and do NOT write. Preferences PUT stays as-is (no revision field).
- **App must not clobber after reload:** two changes in `App.tsx`. (1) The autosave effect currently compares against a mount-time `initialRevision` — replace with a `lastPersistedRevision` ref that updates on every successful save AND on every `engine.replace()` from disk, so a disk-loaded doc does not re-trigger a save of itself. (2) On a 409 from save: skip the write, reload from the repository, `engine.replace()` the fresh doc.
- Client listener (in the module that builds the engine):

```ts
if (import.meta.hot) {
  import.meta.hot.on('novakai:data-changed', () => {
    void repository.load().then((doc) => {
      lastPersistedRevision.current = doc.revision;
      engine.replace(doc);
    });
  });
}
```

- `AGENTS.md`: ≤ 30 lines — what the tool is, `./canvas help`, the grammar block, apply semantics ("a scope block fully declares that scope"), "never edit `public/data/*.json` by hand", dev server binds IPv6 → use `localhost:5173`. **Steer to `./canvas`, never `npm run canvas`** (npm swallows flags without `--`). Don't rely on AGENTS.md being auto-loaded — the no-arg `./canvas` help is the real safety net.
- README: fix URL, add 5-verb summary pointing at `./canvas`.

- [ ] **Step 1:** Implement bridge watch + client listener + docs (no unit test for fs.watch — verified live in Task 8).
- [ ] **Step 2:** `npm run check` — lint + tests + build all green.
- [ ] **Step 3: Commit** `feat: live reload on external data writes; agent authoring contract docs`

### Task 8: End-to-end browser verification (standing rule)

- [ ] **Step 1:** `npm run dev` in the worktree (note the port; the main checkout may hold 5173 — vite will pick 5174; use whatever it prints, `localhost` not `127.0.0.1`).
- [ ] **Step 2:** With `~/.claude/browse` (`launch.sh` once, then `browse.mjs goto/click/scroll/shot`): load the app, screenshot baseline.
- [ ] **Step 3:** `./canvas apply` a demo scope (e.g. "CLI Demo" with 3 modules, 2 wires with contracts) — **watch the open page update without manual reload**; screenshot; click the new nodes: selection highlight + inspector must show interfaces; click a wire: contract label visible.
- [ ] **Step 4:** `./canvas rm cli-demo` — page updates, scope gone; screenshot.
- [ ] **Step 5:** Confirm in-app drag + autosave does NOT trigger a reload loop (drag a node with autosave on; page must not flicker/reload).
- [ ] **Step 5b:** Race check: drag a node, then within the 500ms autosave window run a `./canvas apply` — verify the CLI's scope survives on disk (stale PUT must get 409, app must reload instead of clobbering). Check the dev-server log for the 409 and the file for the applied scope.
- [ ] **Step 6:** Fix anything found; re-verify; commit `test: browser-verified live reload and CLI round trip`.

### Task 9: Zero-context agent trial (the acceptance test)

- [ ] **Step 1:** Spawn a fresh general-purpose subagent with ONLY this prompt shape: "You are in `<worktree path>`. Draw an architecture map for <a small system spec, ~5 modules with interfaces and calls> on the canvas tool in this repo. Figure out how to use whatever tooling the repo provides. Report the exact commands you ran, every error you hit, and how many attempts each step took."
- [ ] **Step 2:** Grade: did it find `./canvas`? Did `help` suffice? How many failed attempts before a green `apply`? Did it hand-edit JSON (failure)?
- [ ] **Step 3:** Every stumble becomes a fix (better error hint, help wording, README line). Re-run with a second fresh agent if fixes were significant.
- [ ] **Step 4:** Commit fixes; write results into `docs/superpowers/plans/2026-07-17-canvas-cli-trial.md`.
