# Experience Lane — design reference and lane briefs

> **Status:** Lead's design pass, 2026-08-06. Builds against
> `2026-08-06-experience-requirements.md` (Chris's verbatim pain points + 12 laws).
> This document is the shared reference for the lead and all builder lanes.

## Mission Contract

**Outcome — MUST**
Novakai Canvas gains an intentionally designed studio experience — shell, canvas feel,
wires — that clears Chris's 15 recorded pain points. Lead (this session) is accountable.

**Done when — MUST**
- Each pain point is un-reproducible in a real browser, verified by the lead personally
  driving the app with screenshots read for visual delight, consistency, and spacing —
  not only logical correctness.
- All four gates exit 0 (both tsc configs, oxlint, vite build, vitest with only the 3
  pre-existing failures).
- Work is committed lane by lane on `claude/canvas-record-model`.

**Operating mode:** delegate (Opus builder lanes; lead designs, integrates, verifies).

**In scope — MUST:** shell panels + components + tokens; canvas interaction; wires.
**Out of scope — MUST:** Novakai shell wiring (Chris's explicit hold),
work-session-reporting, cross-diagram subject links (V4).

**Execution — SHOULD**
- Three parallel Opus lanes in isolated worktrees; slices small enough that a builder
  loop stays well under an hour.
- TDD light: domain logic and routing get tests first; UI slices are screenshot-verified,
  not test-smothered.
- MANDATORY: every builder invokes its named skills and reports "Skills invoked" in its
  final output; the lead confirms before accepting the lane.
- All spacing/color/type through `src/styles/tokens.css`. Side panels built from shared
  components so every panel looks structurally identical.
- Fix rounds per lane capped at 2; a new bug found in round 2 stays round 2. Accept a
  known bug over an endless loop; record it.

**Fallback — MUST:** if a lane stalls or conflicts, the lead lands the slice himself,
smaller; unresolved items are recorded in BUILD-LOG, never silently dropped.

**Escalate only when:** destroying Chris's diagram data, licensing (React Flow badge),
or a requirement conflict that changes the laws.

**Close-out:** BUILD-LOG entry — skills confirmed per lane, testing as run, exit criteria
as enforced, fix rounds used.

## ASCII UX reference (the target)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  >_ novakai  Canvas        [ Present | Edit ]                    Saved     ⟨| |⟩ │ 48px
├───────────────┬──────────────────────────────────────────────────┬───────────────┤
│ RAIL          │ CANVAS                                           │ STUDIO        │
│               │                                                  │               │
│ Filter……      │                                                  │ ┌───────────┐ │
│               │                                                  │ │ ◈ MODULE  │ │
│ DIAGRAMS   17 │        the open diagram                          │ │ Session   │ │
│ ▸ Cmd Overview│        always readable:                          │ │ broker  ✕ │ │
│ ● Agent Brow… │        fitted on first open,                     │ ├───────────┤ │
│ ▸ Mission …   │        your camera remembered after              │ │ Inspect · │ │
│ ▸ Webhook …   │                                                  │ │ Json      │ │
│               │                                                  │ ├───────────┤ │
│ ARCHIVED    2 │                                                  │ │ fields…   │ │
│               │                                                  │ │           │ │
│ + New diagram │                                                  │ │           │ │
│               │  [−][fit][+]                       legend        │ │ danger ▾  │ │
└───────────────┴──────────────────────────────────────────────────┴───────────────┘
 264px, drag-resize     fills; never covered                340px, drag-resize
 ⇤ fully collapsible                                        fully collapsible ⇥
```

- `●` = the open diagram (one gold accent on the rail, nothing else lit).
- Panels PUSH the canvas (which re-fits calmly); they never overlay it.
- Collapse toggles live in the header, matched icons at both ends (observer calm-pass).
- Preferences moves out of the Studio tabs into a header gear → it is app settings,
  not object inspection. (Slice A2; keep Json as a Studio tab — it is object-scoped.)

## View-change semantics — what moves, what never moves

| User act | Camera | Selection | Studio body |
|---|---|---|---|
| Rail row click | **travel**: remembered camera, or fit on first open | cleared | diagram overview (contents) |
| Canvas node/wire click | **never moves** | that object | object inspector |
| Studio contents-row click | **never moves** (peek) | that object | object inspector |
| Contents-row jump icon (⌖) | eases to the object (700ms) | that object | object inspector |
| Click empty canvas (incl. inside a group's empty interior) | never moves | **cleared** | diagram overview |
| Esc | never moves | node → its group → cleared | follows |
| Present ↔ Edit toggle | **never moves** (no remount) | kept | follows |
| Fit button / double-tap | fit | kept | unchanged |
| Panel collapse/resize | canvas re-fits calmly | kept | unchanged |

The rule behind the table: **selection never moves the camera; only explicit travel
does.** Nothing may jump unexpectedly.

## Component contracts (Lane A owns; everyone consumes)

`src/presentation/shell/`:
- `PanelShell` — left|right side, resizable (drag handle, hidden until hover), fully
  collapsible, width persisted in preferences; 700ms structural motion.
- `PanelHeader` — icon + kind tag (mono-caps) + title + trailing actions. The ONE header
  for rail and studio; body structure NEVER changes shape between tabs/selections.
- `PanelSection` — titled group with consistent `--space-4` padding and `--space-3` gaps.
- `FieldRow` — label-above-input, one spacing rhythm; every studio field uses it.
- `RailGroup` / `RailRow` — grouped nav rows: kind glyph, label, count right-aligned;
  active row carries the rail's single gold accent.

All styling through tokens. No component defines its own colors, paddings, or fonts.

## Lane briefs

Cherry-pick order: **B → C → A**. File ownership is exclusive unless marked shared.

### Lane A — Shell & Studio (owns: App.tsx layout, presentation/components/*, NEW presentation/shell/*, styles/base.css, styles/inspector.css, NEW styles/shell.css)
- **A1** Panel primitives + one Studio skeleton: PanelShell/PanelHeader/PanelSection/
  FieldRow; Inspect/Json rebuilt on them; Preferences behind a header gear using the same
  skeleton; identical header/body structure across all studio states. Exit: screenshots
  of every studio state, structure visibly identical; spacing on the 4px grid.
- **A2** The rail: filter, DIAGRAMS/ARCHIVED groups with counts, active-row gold, travel
  on click, + New diagram; toolbar slims to mode + save status + collapse toggles;
  diagram `<select>` and Find leave the toolbar (rail owns both). Exit: screenshots;
  no native select anywhere in the chrome.
- **A3** Resize + collapse: drag handles, matched collapse icons in the header, widths
  persisted to preferences, canvas re-fits calmly on change. Exit: screenshots collapsed/
  narrow/wide; nothing overlays the canvas.

### Lane B — Canvas feel (owns: canvas-surface.tsx, projection.ts projectNodes, nodes/scope-node.tsx, canvas.css layout parts)
- **B1** Deselection trinity: group interiors are not click targets (title bar selects;
  empty interior = pane click), Esc steps selection out (node → group → cleared), dim
  always releases. Exit: Chris's deselect pain un-reproducible in browser.
- **B2** Camera discipline: no remount on mode toggle (interactivity via props, not key);
  per-diagram camera memory (in-surface map), fit on first open, fit control present.
  Exit: mode toggle and diagram switching never jump; switch back restores camera.
- **B3** True canvas: drop `extent: 'parent'`; `+ Add` places at viewport center;
  dragging a node re-parents by geometry on drag-end (into the group you drop on, out
  when you leave). Exit: add + drag anywhere works; membership follows placement.

### Lane C — Wires (owns: edges/*, wire-styles.ts, projection.ts projectEdges, canvas.css wire parts, domain wire-route additions + tests)
- **C1** Legibility: `--wire` default stroke (faint ONLY when dimmed), labels attached to
  their wire with a surface-colored halo, parallel wires offset so they never overlap.
  Exit: screenshots at working zoom on Command Overview (44 nodes) read clearly.
- **C2** Manipulation: endpoint handles visible on selection and draggable to another
  port (identity preserved — existing `wire.reconnect`); selected wire carries the gold;
  label position adjustable along the wire (persisted as route hint label offset).
- **C3** Routing: elbow router avoids unrelated node rects (padded obstacle avoidance,
  deterministic); draggable waypoints persisted through a new `wire.setRoute` command
  (route-hint format already settled in the schema; TDD the command + router).
  Exit: no wire crosses an unrelated node on any of the 18 real diagrams.

### Mandatory for every lane
- Invoke `elite-codebase-engineering` at start; Lane A also invokes `interface-design`.
  Report "Skills invoked" in the final output — the lead rejects the lane without it.
- Slices land one at a time; run the gates before reporting each slice.
- Browser-verify your own work with `~/.claude/browse` screenshots before reporting;
  the lead re-verifies everything personally after cherry-pick.
- Never run `git checkout public/data` unless you made test edits; verify
  `git status --short public/data` is clean before reporting.
