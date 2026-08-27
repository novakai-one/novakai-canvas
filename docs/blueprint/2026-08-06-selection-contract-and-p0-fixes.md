> Historical only. For current instructions use `../../AGENTS.md` and `../architecture.md`.

# Selection contract + P0 fixes — implementation plan

> **Companion to** `2026-08-06-cohesion-plan.md` (Fable's W-1…W-5). That plan fixes the
> *regions*. This one adds the contract that makes them one app, corrects the priority
> order, and carries the measurements that change what the fixes should be.
>
> **For agentic workers:** steps use `- [ ]` checkboxes. TDD throughout.

**Goal:** Stop the save regression destroying diagram files, make wires connectable by hand,
and establish one written selection contract so parallel lanes stop producing three apps.

**Architecture:** The canvas already has the right domain split (semantic record vs named
layouts). The defects are all in the *seam layer*: the on-disk format is decided by whichever
client PUTs, the ports are rendered inside a scaled viewport so they shrink to nothing, and no
document states what a selection is or what each surface owes it.

**Tech Stack:** React 19 + `@xyflow/react` (React Flow v12), Vite dev-server plugin bridge
(`tools/json-file-bridge.ts`), Zod schemas, Vitest.

## Global constraints

- Node/browser split: `src/` is browser code, `tools/` is dev-server/CLI code. The bridge is
  the only writer to `public/data/`.
- On-disk diagram format is **2-space indented JSON with a trailing newline**. Non-negotiable.
- Camera never moves itself (Chris's standing law). Any change here needs an explicit opt-in.
- Existing failing tests at baseline: 3 × report-session (unrelated), 1 × `routing-gate`
  stale count. Do not "fix" the report-session ones in this plan.

---

## Part 1 — The selection contract (the missing artefact)

Fable's W-5 is "a cohesion audit pass … comparing every region against tokens". That is a
*visual* sweep, and it will not fix the thing Chris actually felt. The "three apps" feeling is
not spacing drift. It is that **one gesture means three different things**:

```
click a node on canvas    →  INSPECT   (studio shows it)
click a row in the studio →  NAVIGATE  (selection changes; CONTENTS list is destroyed,
                                        no breadcrumb, no way back)
click a row in the rail   →  LOAD      (whole document swaps)
```

### The rule

> **There is exactly one selection.** It is owned by the workspace, never by a surface.
> Every surface *subscribes*; no surface keeps its own copy.
> **Selecting never destroys the path back to what you were browsing.**

### Per-surface obligations

| Surface | On selection change it MUST | It MUST NOT |
|---|---|---|
| Canvas | Emphasise selected + one-hop neighbours; recede the rest | Move the camera |
| Rail | Highlight the owning diagram | Change selection on hover |
| Studio | Show the record for the selection, with a **breadcrumb back to its container** | Discard the container listing without an affordance to return |
| Toolbar | Scope actions to the selection kind | Offer actions the kind cannot perform |

### Verbs are distinct and must look distinct

- **Inspect** — show a record. Never changes what is selected.
- **Navigate** — change the selection. Always leaves a breadcrumb.
- **Travel** — change the document, and only then may the camera move.

A studio row that navigates must be visibly a link (chevron/affordance); a row that only
inspects must not look like one. Today they are identical, which is why Chris hit it.

### Why this is the root artefact

Every W-lane in the companion plan touches at least two surfaces. Without this table, each
lane re-decides the grammar locally — which is exactly how three builders produced three apps.
**Any lane that changes selection behaviour cites this table in its exit criteria.**

---

## Part 2 — Corrected priority

Fable's plan files the save regression as "slots into W-1 as a correctness fix". That is wrong
by severity: it is the only defect that **destroys data on every run**, and it corrupts more
files the longer the UX work takes. It is P0 and it blocks nothing, so it goes first.

| P | Item | Why this rank |
|---|---|---|
| **P0** | Save canonicalisation + repair damaged files | Actively destroying files, every session |
| **P1** | Ports connectable (zoom-invariant, 4 sides) | "I can't connect wires to anything" — measured at **2×2 px** |
| **P2** | Navigation defaults (scroll pans, ⌘Z, free the double-click) | Muscle memory broken against every peer tool |
| **P3** | Wire + interface studio states become editors | Read-only viewers over an editable model |
| **P4** | Fable's W-1/W-2/W-3/W-5 chrome + rail + studio design | Real, but nothing is being lost while they wait |

---

## Task 1 — The server owns the on-disk format (P0)

**Root cause (verified):** `tools/json-file-bridge.ts:85` writes `raw` — the exact bytes the
client sent — straight to disk. `src/adapters/file-library-repository.ts:66` sends
`JSON.stringify(parsed)` with no indent. The seed path (`:108`) uses `null, 2`. So seeded
files are pretty and every UI-written file becomes one line.

Measured at HEAD: **4 of 19 diagram files already minified** (`browser-scope`,
`command-overview`, `messaging-scope`, `diagram-a781512a`); the other 15 are 96–477 lines.

**Fix at the right layer.** Making the browser send pretty bytes fixes today's symptom and
leaves the hole open for the CLI, curl, or a future agent. The file format is the *bridge's*
invariant. Canonicalise on write; fix the client too, but the guarantee lives server-side.

**Files:**
- Modify: `tools/json-file-bridge.ts` (`writeRecordFile`, and the `handle` PUT path)
- Modify: `src/adapters/file-library-repository.ts:66`
- Test: `tools/json-file-bridge.test.ts`

- [ ] **Step 1: Write the failing test** — compact bytes in, pretty file out.

```ts
it('canonicalises compact JSON to 2-space indent with trailing newline', async () => {
  const file = join(dir, 'x.json');
  const outcome = await writeRecordFile(file, '{"id":"x","revision":1,"nodes":{}}', 0);
  expect(outcome.status).toBe('written');
  const onDisk = await readFile(file, 'utf8');
  expect(onDisk).toBe('{\n  "id": "x",\n  "revision": 1,\n  "nodes": {}\n}\n');
});

it('leaves a non-JSON body untouched rather than throwing', async () => {
  const file = join(dir, 'y.json');
  await expect(writeRecordFile(file, 'not json', 0)).resolves.toEqual({ status: 'written' });
  expect(await readFile(file, 'utf8')).toBe('not json\n');
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `npx vitest run tools/json-file-bridge.test.ts`
Expected: FAIL — receives the compact single-line string.

- [ ] **Step 3: Implement canonicalisation**

```ts
/**
 * Renders the bytes a record file should hold.
 *
 * The on-disk shape is this bridge's invariant, not its callers'. Every writer — browser,
 * CLI, curl — lands the same 2-space indented, newline-terminated form, so a diagram stays
 * reviewable in a diff no matter which client last touched it. A body that is not JSON is
 * passed through unchanged: this function canonicalises, it does not validate.
 */
function canonicalJson(raw: string): string {
  try {
    return `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;
  } catch {
    return raw.endsWith('\n') ? raw : `${raw}\n`;
  }
}
```

Then use it in both write paths (`writeRecordFile` and the `handle` PUT branch), replacing
`raw.endsWith('\n') ? raw : `${raw}\n``.

- [ ] **Step 4: Run tests, expect PASS**
- [ ] **Step 5: Fix the client too** — `file-library-repository.ts:66` →
      `body: `${JSON.stringify(parsed, null, 2)}\n``, matching `http-json-repository.ts:54`.
- [ ] **Step 6: Repair the 4 damaged files** (reformat only — no semantic change):

```bash
for f in browser-scope command-overview messaging-scope diagram-a781512a; do
  node -e "const p='public/data/diagrams/$f.json';const fs=require('fs');
    fs.writeFileSync(p, JSON.stringify(JSON.parse(fs.readFileSync(p,'utf8')),null,2)+'\n')"
done
git diff --stat public/data/diagrams   # expect large +/- line counts, zero semantic change
```

- [ ] **Step 7: Verify the round trip in a real browser** — edit a diagram in the app, then
      `wc -l` the file. Must be >1 line.
- [ ] **Step 8: Commit**

---

## Task 2 — Ports you can actually hit (P1)

**Root cause (verified):** handles are 6px CSS *inside the scaled React Flow viewport*. At the
app's own default fit for `browser-scope` (`scale(0.345)`) they render at **2×2 physical
pixels** — measured via `getBoundingClientRect()` with opacity confirmed at 1. Chris's "they
are not visible" and "I can't connect wires to anything" are the same defect. The connect
*capability* works — a synthetic exact-centre drag took edges 12 → 13.

Also: `src/domain/flow.ts` declares one `sourcePort: 'bottom'` and one `targetPort: 'top'`, so
every wire must run downward and dropping on a different side is a no-op — Chris's exact
reproduction.

**Files:**
- Modify: `src/styles/canvas.css:289` (handle sizing)
- Modify: `src/presentation/nodes/architecture-node.tsx`, `scope-node.tsx` (4 sides)
- Modify: `src/domain/flow.ts` (port set)
- Test: `src/presentation/nodes/port-hit-area.test.ts` (new)

- [ ] **Step 1: Make the hit area zoom-invariant.** React Flow exposes the live zoom as the
      CSS variable it sets on the viewport; the reliable route is to counter-scale the handle
      so its *screen* size is constant. Target: **≥10px visible dot, ≥16px hit area**, at every
      zoom from 0.05 to 2.

```css
.react-flow__handle {
  width: 10px; height: 10px;
  /* Counter-scale so the port keeps its screen size: a port that shrinks with the
     diagram is a port nobody can hit — measured at 2px before this. */
  transform-origin: center;
  scale: calc(1 / var(--nvk-zoom, 1));
}
.react-flow__handle::after {   /* invisible generous target, per the drop-target rule */
  content: ''; position: absolute; inset: -6px;
}
```

`--nvk-zoom` is published from the existing `onMove`/viewport handler in `canvas-surface.tsx`.

- [ ] **Step 2: Four sides.** Render N/S/E/W handles per node, each both source and target,
      with stable ids (`n`,`s`,`e`,`w`) so `preferredSide` in the schema can address them.
- [ ] **Step 3: Contrast.** Ports currently paint `--card-3` on `--accent-dim` — dark on dark.
      Use the gold accent at rest-on-hover so the affordance reads.
- [ ] **Step 4: Verify in a real browser** — hover a node at default zoom, screenshot, confirm
      the dots are visible; drag each of the four sides to another node and confirm it sticks.
- [ ] **Step 5: Routing gate must stay green** (`npx vitest run src/presentation/edges/routing-gate.test.ts`).
- [ ] **Step 6: Commit**

---

## Task 3 — Navigation defaults (P2)

Measured: plain wheel **zooms** (`scale 0.548 → 0.415`); double-click **zooms**
(`0.548 → 2.0`); `⌘Z` and `Ctrl+Z` are unbound (the Undo *button* works).

Every peer tool (Figma, Miro, Lucid, tldraw) pans on scroll and zooms on pinch/⌘-scroll.

**Files:** `src/presentation/components/canvas-surface.tsx:286-291`, plus a key handler.

- [ ] **Step 1:** `panOnScroll` on, `zoomOnScroll` off, `zoomOnPinch` on, `zoomOnDoubleClick`
      off. Chris confirmed pinch-zoom already "feels totally fine" — do not touch it.
- [ ] **Step 2:** Bind `⌘Z` / `Ctrl+Z` to the same undo the button calls. Guard against
      firing while focus is in a studio text input.
- [ ] **Step 3:** Freeing the double-click leaves the natural create gesture available for a
      later lane (double-click empty canvas → node at cursor, in edit mode). **Not built here** —
      noted so the next lane knows the gesture is reserved and why.
- [ ] **Step 4: Verify in a real browser.** Two-finger scroll pans; pinch zooms; ⌘Z undoes a
      node move; double-click does nothing.
- [ ] **Step 5: Commit**

---

## Task 4 — Wire studio becomes an editor (P3)

**Verified:** with a wire selected the entire document contains **one** `<input>` — the rail's
filter. Label, Kind, From, To, Path are dead text. The node studio is a full editor. This is
the same defect as the "sad" interface panel: a viewer over a model that is editable.

Covered by Fable's W-3; this task carries the measurement and the contract citation.

- [ ] **Step 1:** Wire label → editable `FieldRow` (the existing shell primitive).
- [ ] **Step 2:** Kind → segmented control over the four legend kinds.
- [ ] **Step 3:** From/To → peek chips that **navigate** (per the contract: leave a breadcrumb).
- [ ] **Step 4:** Interface state: `Accepts` / `Returns` become links to the type records —
      `types` are first-class in the model with their own IDs, and the panel currently throws
      that join away.
- [ ] **Step 5: Verify in a real browser**, one screenshot per selection kind.
- [ ] **Step 6: Commit**

---

## Task 5 — Unstick the routing gate (housekeeping)

`src/presentation/edges/routing-gate.test.ts:74` asserts `toHaveLength(18)`; there are 19
diagram files, so the gate is red for a reason unrelated to routing (the 21 routing assertions
pass). A hardcoded corpus count breaks every time the UI creates a diagram — which it can.

- [ ] **Step 1:** Assert against the discovered file count and a non-zero floor instead of a
      literal, so the gate tracks the corpus.
- [ ] **Step 2:** `npm test` — canvas suites green; the 3 report-session failures remain
      pre-existing and out of scope.
- [ ] **Step 3: Commit**

---

---

## Outcome (2026-08-06)

Six commits on `claude/canvas-cohesion`, each driven in a real browser before being claimed.

| Task | State | Evidence |
|---|---|---|
| 1 — bridge owns the on-disk format | **done** | UI edit writes 1114 readable lines where it wrote 1; 5 damaged files restored, each verified byte-identical as parsed JSON |
| 2 — ports you can hit | **done** | 2px → 10px, constant from 0.18× to 1.64×; four sides; all four connect |
| 3 — navigation defaults | **done** | scroll pans, ⌘-scroll zooms, double-click inert, ⌘Z undoes |
| 4 — wire + interface studios | **done** | `wire.update` / `interface.update` added to the record layer; label, kind and name editable; endpoints and types navigable |
| 5 — routing gate unstuck | **done** | asserts a floor, not a literal corpus size |
| — panel toggles findable | **done** (added) | moved from mid-canvas to the seam each panel opens on |
| — one drag is one undo step | **done** (added) | found while verifying Task 3; see correction below |

### Correction to my earlier review

I reported "undo covers layout — P7 disproven". **That was wrong.** Undo did not restore a node
move; I read a screenshot that merely looked right instead of comparing the transform. The
cause was real and is now fixed: React Flow reports a position change per frame and each was
committed, so one drag cost dozens of history entries and undo popped an invisible sub-pixel
step. Position is now written only by `onNodeDragStop`.

### Known-remaining, explicitly not done

Named here so none of it arrives as a surprise:

- **No breadcrumb in the studio.** Clicking a row still replaces the contents list with no path
  back. The contract in Part 1 says navigate must leave one; the endpoint and type rows added in
  Task 4 inherit this gap.
- **Rail is still a flat alphabetical list**, unreadable at narrow widths, and "Filter" is still
  a filter rather than a search that reaches node labels. Fable's W-2 covers this; untouched.
- **No create-on-canvas.** Double-click is now free for it, deliberately, but the gesture is not
  built — nor is drag-a-wire-into-empty-space-makes-a-node.
- **Present/Edit, Add and Undo still live in the floating toolbar**, not the side panels as Chris
  expected. Fable's W-1 covers this; only the panel toggles moved.
- **`preferredSide` is not stored on drop.** The four ports connect and stick for the session,
  but the router does not yet persist which side a wire end was dropped on.
- **Untested by me:** marquee multi-select, ⌥-drag clone, copy/paste, alignment guides, the
  Theme/Nodes/Wires/Panel/Files preference tabs, and 18 of the 19 diagrams.
- **3 pre-existing test failures remain** in `report-session` / `work-session-report`. They were
  red at baseline, are unrelated to the canvas, and were deliberately left alone.

## Verification standard for this plan

Per Chris's standing rule, **no item is reported done until it has been driven in a real
browser** with `~/.claude/browse` — clicking the actual control, reading the actual screenshot.
Tests and typecheck are necessary and never sufficient.

And per his last correction: **the close-out lists every known rough edge, not a subset.**
Anything left untested is named as untested.
