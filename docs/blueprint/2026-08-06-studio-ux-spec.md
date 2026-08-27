> Historical only. For current instructions use `../../AGENTS.md` and `../architecture.md`.

# Novakai Canvas — Studio UX Spec

**Status:** FROZEN at first write. No build beyond what is specified here.
**Branch:** `claude/canvas-studio-ux` off `main` @ `68e6789`
**Dev URL:** http://127.0.0.1:5185/
**Author:** Claude, from Chris's review 2026-08-06
**Baseline:** 453 tests pass, 3 pre-existing failures (all `report-session`, unrelated).

---

## 0. Product truth this spec serves

Canvas is **a general diagramming tool** — flowcharts, clusters, process diagrams, agentic
operation loops, mapping out thinking, understanding a codebase. Not exclusively software
architecture; the 19 existing diagrams are all Novakai systems only because that is where
Chris's time goes.

It is **two-way AI↔human, ~70% AI authoring / 30% Chris drawing**. AI authors via CLI.
Chris opens diagrams he did not draw, reads them, adjusts them. **Reading and adjusting
outrank creating.**

**JSON export is a first-class act**: "I can just copy the json and give it to AI, they see
the flow."

Chris is a **visual-spatial thinker**: location, groups, clusters and hierarchy all carry
meaning. The canvas is the product; the panels are service.

Session shape: find a diagram once, then stay in it for a long time.

---

## 1. Design principle

**Minimalism and low visual stimulation.** Completeness is sacrificed for visual
cleanliness: breathing room, spacing, whitespace.

Three mechanical consequences, not aspirations:

1. **Tabs gate what is eligible to render.** Only one surface renders per panel at a time.
2. **One section open at a time.** Opening a section closes its siblings. The most on screen
   is one expanded section plus its sibling heading rows.
3. **The section list per tab is fixed and short.** New things go inside an existing section
   or get their own tab. The count does not drift.

**Left changes the canvas. Right explains what is on it. The library is travel and is not
resident.**

Nothing in the left panel ever changes position. Expansion opens *over* or *beside*, never
pushes rows down.

---

## 2. Current-state evidence

Measured in the browser at 1470 × 813, `main` @ 68e6789.

| Measurement | Value |
|---|---|
| Left rail | 232px |
| Right studio | 520px |
| Chrome total | **752px (51%)** |
| Canvas | **718px (49%)** |
| Novakai Design, same screen | 276 + 318 = 594px chrome (40%), canvas 858px |

Redundancy in the right panel on one node selection (`Session broker`):

| Shown | Repeated as |
|---|---|
| `Session broker` (title) | `Session broker` (Name input) |
| `Agent Browser Sessions ›` (breadcrumb) | `in Agent Browser Sessions` (meta) |
| — | `Position 552, 216` (canvas already shows position) |
| — | `Types 0` (a rendered zero) |
| — | `10 objects · 12 wires · r2417` (canvas already shows the count) |

Source of the incongruence: `inspect-panel.tsx:130-194` renders one `PanelSection` per record
field-group. It is a serialisation of `DiagramRecord`, not an answer to a question.

Search noise: typing "session" renders comment bodies as nav rows — one result is a
four-line paragraph ("Assign a Person to a Mission role. One Person may have zero or many
live Presences…").

---

## 3. Surface map — component trees

### 3.1 App shell

```
┌──────────────────────────────────────────────────────────────────────────┐
│  AppHeader                                              48px             │
│  ┌────────────┬──────────────────────────────┬───────────────────────┐   │
│  │ Wordmark   │        (empty — no filler)   │ Saved · ⌘Z ⌘⇧Z ·      │   │
│  │ >_ novakai │                              │ Present|Edit · Copy   │   │
│  └────────────┴──────────────────────────────┴───────────────────────┘   │
├──────────┬────────────────────────────────────────────┬──────────────────┤
│          │                                            │                  │
│  Rail    │            CanvasSurface                   │    Studio        │
│  264px   │                                            │    340px         │
│          │                                            │                  │
└──────────┴────────────────────────────────────────────┴──────────────────┘
```

`AppHeader` earns exactly five things. No device/viewport icons — Canvas has one viewport.
No filler in the middle. `Copy` copies the diagram JSON to the clipboard in one click and
flashes `Copied` for 1.2s; it replaces the `Json` tab as the export act.

React components:

```
<AppShell>
  <AppHeader>            // NEW — src/presentation/shell/app-header.tsx
    <Wordmark/>
    <HeaderActions>      // SaveState, UndoRedo, ModeToggle, CopyJson
  </AppHeader>
  <ShellBody>
    <Rail/>              // left
    <CanvasSurface/>
    <Inspector/>         // right (Studio)
  </ShellBody>
</AppShell>
```

### 3.2 Left panel — Rail

```
┌─ PanelShell (side=left, --surface-1) ────────────┐
│ ┌─ PanelHeader ────────────────────────────────┐ │
│ │  ⇤  Canvas                                   │ │   ← collapse control lives HERE
│ │     Agent Browser Sessions          ▾        │ │   ← diagram switcher (opens overlay)
│ └──────────────────────────────────────────────┘ │
│ ┌─ TabStrip ───────────────────────────────────┐ │
│ │   Build      Contents                        │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ PanelBody ──────────────────────────────────┐ │
│ │                                              │ │
│ │  ── Build tab ──────────────────────────     │ │
│ │                                              │ │
│ │  SHAPE ─────────────────────────────         │ │  PanelSection (divider)
│ │    ▢  Shape                     ▸            │ │  flyout: kind picker
│ │    ▣  Group                                  │ │
│ │    ▭  Note                                   │ │
│ │                                              │ │
│ │  WIRE ──────────────────────────────         │ │
│ │    Default kind        references ▾          │ │
│ │    Default shape       elbow      ▾          │ │
│ │                                              │ │
│ │  ── Contents tab ───────────────────────     │ │
│ │                                              │ │
│ │  OBJECTS                            10 ──    │ │
│ │    MODULE   Session broker                   │ │  ObjectRow (peek/jump)
│ │    OBJECT   Lease                            │ │
│ │    …                                         │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Fixed geometry.** In the Build tab the rows are always the same rows in the same
positions: 3 shape rows, 2 wire rows, 2 section headings. Nothing accordions here.

**The kind picker is a flyout, not an expansion.** Clicking `Shape ▸` opens a small
positioned menu beside the row listing `Module · Object · Runtime · Resource`. It overlays;
it does not push rows down. Placing a shape uses the last-picked kind, so the common act is
one click.

**Contents moves here from the right panel.** It is navigation of what is on the canvas —
Canvas's equivalent of Design's `Layers`. This is what stops the right panel from turning
into a navigator.

### 3.3 Library overlay

```
      ┌─ LibraryOverlay ───────────────────────────────────┐
      │  Search diagrams and objects                       │
      │  ────────────────────────────────────────────────  │
      │  DIAGRAMS                                    19 ──  │
      │    ● Agent Browser Sessions                        │
      │      Agent Messaging                               │
      │      …                                             │
      │  OBJECTS                                      6 ──  │
      │    Session broker      Agent Browser Sessions      │
      │    …                                               │
      │  ────────────────────────────────────────────────  │
      │  + New diagram                          Archived ▸ │
      └────────────────────────────────────────────────────┘
```

Opens from the diagram-name row in the rail header. Closes on pick, on Escape, on
outside-click. Object result rows are **one line, truncated** — `rail-label.ts` already owns
label shortening; comment bodies get the same treatment as everything else.

The 19 diagrams are one click away for the person who wants them and invisible for the
person who does not.

### 3.4 Right panel — Studio

Nothing selected:

```
┌─ PanelShell (side=right) ────────────────────────┐
│ ┌─ PanelHeader ────────────────────────────────┐ │
│ │  Agent Browser Sessions              ⚙  ⇥    │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ PanelBody ──────────────────────────────────┐ │
│ │                                              │ │
│ │        Select an object to inspect it.       │ │  ← empty means empty
│ │                                              │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

The panel **stays**. Chris: "you cannot take away the panel from user without them saying
so." It does not backfill with add-buttons or a contents list.

Node selected:

```
┌─ PanelShell (side=right) ────────────────────────┐
│ ┌─ PanelHeader ────────────────────────────────┐ │
│ │  Agent Browser Sessions ›            ⚙  ⇥    │ │  ← trail (links)
│ │  MODULE                                      │ │  ← kind, mono caps
│ │  Session broker                        ⋯     │ │  ← title IS the editable field
│ └──────────────────────────────────────────────┘ │
│ ┌─ PanelBody ──────────────────────────────────┐ │
│ │  DESCRIPTION ───────────────────────         │ │  open by default
│ │    acquire / release / lookup; owns          │ │
│ │    pool state                                │ │
│ │                                              │ │
│ │  INTERFACES                          2 ──    │ │  collapsed heading only
│ │  PLACEMENT ──────────────────────────        │ │  collapsed heading only
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Deleted outright**: the `Name` field (the title is the field), `in <parent>` meta (the
trail says it), `10 objects · 12 wires · r2417`, the `FACTS` grid, `Position`, `Types 0`,
the full-width `Delete object` button (moves into `⋯`), the `ADD TO THIS DIAGRAM` block
(moves to the left panel), the `Json` tab (becomes `Copy` in the header).

**Section count is 3 for a node**: Description, Interfaces, Placement. One open at a time.

Wire selected:

```
│  RELATIONSHIP ───────────────────────         │  open
│    Label      connects                        │
│    Kind       references            ▾         │
│    Shape      elbow                 ▾         │
│    From → To  browse CLI → Session broker     │
│                                               │
│  ROUTING ────────────────────────────         │  collapsed
```

Settings (gear pressed) reuses the same skeleton: header `Preferences`, TabStrip of
sections, body of `PanelSection`s. Structurally identical to inspecting an object — this is
already true and stays true.

---

## 4. Design system

### 4.1 Type scale

Existing tokens hold. One addition, one correction.

| Token | Value | Used for |
|---|---|---|
| `--text-xs` | 10.5px | mono-caps section headings, counts, kind tags |
| `--text-sm` | 12px | secondary rows, descriptions, hints |
| `--text-base` | 13px | body, fields, rail rows, object rows |
| `--text-lg` | 15px | panel titles |
| `--text-xl` | 18px | diagram title |
| `--text-wire` | **NEW** `12px` | wire labels — was `--text-xs`, unreadable at working zoom |

Font: Inter for everything. Mono (JetBrains Mono) only for the wordmark, section headings,
and real terminal output. Never on ordinary labels.

Section headings: `--text-xs`, mono, uppercase, `letter-spacing: var(--tracking-caps)`,
colour `--ink-faint`.

### 4.2 Spacing

4px base grid, already in tokens. This spec pins which token goes where so "breathing room"
is a number, not an opinion.

| Location | Token | Value |
|---|---|---|
| Panel outer padding (x) | `--space-4` | 16px |
| Between sections | `--space-6` | 24px |
| Section heading → first row | `--space-3` | 12px |
| Between rows in a section | `--space-2` | 8px |
| Row inner padding (y) | `--space-2` | 8px |
| Field label → control | `--space-1` | 4px |
| Panel header padding | `--space-4` / `--space-5` | 16px / 20px |
| Header → tab strip | `--space-3` | 12px |

`--space-6` between sections is the single biggest source of calm and is deliberately larger
than anything inside a section, so grouping reads from spacing alone before the divider is
noticed.

### 4.3 Section heading + divider

```
INTERFACES                                    2 ────────────────
^ mono caps, --text-xs, --ink-faint          ^ count  ^ hairline to panel edge
```

The rule is `1px solid var(--edge-soft)`, vertically centred on the heading's cap height,
running from after the label/count to the panel's inner edge. Not a full-width line above
or below — the label sits *in* the rule.

### 4.4 Surface ladder — **must #8**

**Current bug**: the panel shell is `--surface-1` (#121214) but inputs, fields and inner
rows use `--surface-page` (#0d0d0f) — the *darkest* value in the system. The innermost
surface is currently the darkest, which is exactly inverted. Confirmed at `shell.css`
lines 246, 404, 452, 606.

Corrected ladder — children are always lighter than their parent, and the deepest surface
is never dark:

| Level | Token | Dark | Light | What sits here |
|---|---|---|---|---|
| 0 page | `--surface-page` | `#0d0d0f` | `#f7f5ef` | canvas only |
| 1 panel | `--surface-1` | `#121214` | `#f2efe7` | panel shell |
| 2 section | `--surface-2` | `#1b1b1e` | `#faf8f2` | expanded section body |
| 3 control | `--surface-3` | `#252529` | `#ffffff` | inputs, textareas, selects, flyouts |

Every `background: var(--surface-page)` inside `.panel-shell` becomes `var(--surface-3)`.
`--surface-page` is banned inside a panel. A test asserts this.

### 4.5 Hit-target scale — **must #5**

**Root cause found.** Only node ports are zoom-corrected. Everything else on the canvas is
sized in flow units and therefore shrinks with the viewport:

| Control | Current | At zoom 0.6 | Correct |
|---|---|---|---|
| Node port | `10px / var(--nvk-zoom)` | 10px ✓ | already right |
| Resize handle | fixed `7px` | **4.2px** | `--target-sm / zoom` |
| Wire endpoint | `r={7}` flow units | **8.4px ⌀** | `--target-md / zoom` |
| Wire waypoint | `r={5}` flow units | **6px ⌀** | `--target-md / zoom` |
| Wire label | `--text-xs` flow units | **6.3px** | `--text-wire / zoom`, floored |

New tokens, all screen-constant:

```css
--target-sm: 9px;    /* resize handles */
--target-md: 12px;   /* wire endpoints, waypoints — the visible dot */
--target-grab: 22px; /* the INVISIBLE pointer target around any grabbable dot */
```

`--target-grab` is the fix for **must #3**: the visible dot stays small and calm, but a
transparent circle of `--target-grab` diameter carries `pointer-events`. You grab a region,
not a pixel, so letting go early no longer snaps back.

All three are exposed as a single `Target size` preference (§5).

### 4.6 Motion

`--motion-structural: 700ms` for panel open/close/flyout. `--motion-quick: 150ms` for
hover/press feedback. No new motion values.

### 4.7 Accent scarcity

One gold signal at a time. Gold is reserved for: the active diagram row, the selected
wire/node, the pressed tab, and the primary header action. Section headings, counts,
dividers and idle rows are never gold.

---

## 5. Settings to expose

Rather than guessing, every judgement call in §4 becomes a preference. Additions to
`CanvasPreferences` (`schemaVersion` stays 1; all new keys optional with defaults, so
existing preference files open unchanged).

### `appearance`
| Key | Type | Default | Effect |
|---|---|---|---|
| `density` | `compact \| comfortable \| roomy` | `comfortable` | scales `--space-*` by 0.85 / 1 / 1.25 |
| `textScale` | `0.9 – 1.3` | `1` | scales every `--text-*` token |
| `theme`, `accent`, `radius` | existing | — | unchanged |

### `canvas`
| Key | Type | Default | Effect |
|---|---|---|---|
| `targetSize` | `small \| medium \| large` | `medium` | scales `--target-*` (0.85 / 1 / 1.3) |
| existing grid/controls/legend/groupPadding | — | — | unchanged |

### `wires`
| Key | Type | Default | Effect |
|---|---|---|---|
| `shape` | `elbow \| straight \| curved \| stepped` | `elbow` | default route shape — **must #7** |
| `labelSize` | `0.9 – 1.4` | `1` | scales `--text-wire` — **must #4** |
| `avoidNodes` | `boolean` | `true` | obstacle routing on/off — **must #1** |
| existing showLabels/width/dimUnrelated | — | — | unchanged |

### `panel`
| Key | Type | Default | Effect |
|---|---|---|---|
| `sections` | `accordion \| all-open` | `accordion` | one open at a time, or the old everything |
| `showDividers` | `boolean` | `true` | section rules on/off |
| `leftDefaultTab` | `build \| contents` | `build` | which left tab opens |
| existing width/railWidth/collapsed/reframeOnPanelMove | — | — | unchanged |

Preference sections gain no new tabs: `theme` takes density/textScale, `canvas` takes
targetSize, `wires` takes shape/labelSize/avoidNodes, `panel` takes the rest.

---

## 6. The nine musts — how each is met

### Must 1 — Wires must not cut through nodes
`wire-routing.ts` already scores candidate routes with `collisions` dominating
(`score()`: `collisions * 1e9`). `elbow-edge.tsx:40` already forwards obstacles. **Remaining
gap**: nothing proves it on Chris's real diagrams at the app's own render path.
→ Slice 5 adds a routing gate test that loads every diagram in `public/data/diagrams/`,
routes every wire with the same obstacle set the component passes, and asserts
`collisions === 0`. Plus `wires.avoidNodes` to turn it off.

### Must 2 — Viewport must never move for an unrelated activity
`useRefitWhenPanelsMove` is already opt-in and off by default
(`reframeOnPanelMove ?? false`). `zoomOnDoubleClick={false}`. Escape never touches the
camera. **Remaining gap**: no test locks it.
→ Slice 6 adds a test asserting the default preference is `false` and that panel
collapse/resize issues no camera call when it is false. Verified in-browser by collapsing
each panel and comparing viewport transform before/after.

### Must 3 — Wires must be draggable without snapping back
Endpoint drag is hand-rolled with pointer capture (`elbow-edge.tsx:167-195`) — the
mechanism is right; the target is 8px at working zoom.
→ Slice 4: `--target-grab` transparent hit circle (22px screen-constant) concentric with
every endpoint and waypoint. The dot you see stays calm; the region you grab is
2.6× wider. Release resolves via `elementFromPoint`, unchanged.

### Must 4 — Wire labels must be readable
→ Slice 4: `--text-wire` (12px) replaces `--text-xs` (10.5px) for labels, divided by
`--nvk-zoom` so the label is 12 physical px at every zoom, with `wires.labelSize` to taste.
Existing background+text-shadow halo is kept — it already reads as a gap in the wire.

### Must 5 — Everything is miniscule
→ Slice 4, per §4.5 table. Resize handles, endpoints, waypoints all become screen-constant
via `--nvk-zoom`, sized from `--target-*`, scalable by `canvas.targetSize`.

### Must 6 — Dragging a port onto empty canvas
React Flow's `onConnectEnd` fires with no connection when a drag lands on the pane.
→ Slice 5: on that event, place a new shape of the current default kind at the drop point
and wire to it in one undoable act. A wire is a first-class object already
(`wire.add` takes explicit endpoints), so "leave the wire" is the same code path with a
zero-size anchor node — **out of scope for this spec**: only create-node-at-drop ships.
Deferred to backlog: dangling wires with no target node.

### Must 7 — Different wire shapes
→ Slice 5: `wires.shape` preference plus a per-wire override on the wire inspector.
`elbow` (existing router), `straight` (direct line, no routing), `curved` (bezier through
the same route points), `stepped` (existing route with zero corner radius). All four render
from the same `routeWire` output — only `routePath` changes — so obstacle avoidance holds
for every shape.

### Must 8 — No dark background as the final panel surface
→ Slice 1, per §4.4. `--surface-page` banned inside `.panel-shell`; ladder corrected;
architecture test asserts it.

### Must 9 — Side panels organised as discussed
→ Slices 2 and 3, per §3.2–§3.4.

---

## 7. Module contracts

New and changed public interfaces. Every module exports a typed contract; nothing reaches
into another's internals.

```ts
// src/presentation/shell/app-header.tsx — NEW
export interface AppHeaderProps {
  diagramName: string;
  saveStatus: string;
  mode: CanvasMode;
  changeMode: (mode: CanvasMode) => void;
  canUndo: boolean;
  undo: () => void;
  copyJson: () => Promise<void>;
}
export function AppHeader(props: AppHeaderProps): JSX.Element;

// src/presentation/shell/panel-section.tsx — CHANGED
export interface PanelSectionProps {
  title?: string;
  trailing?: ReactNode;
  /** Accordion membership. Absent = always open (used by settings). */
  sectionId?: string;
  open?: boolean;
  onToggle?: (sectionId: string) => void;
  fill?: boolean;
  children: ReactNode;
}

// src/presentation/shell/flyout.tsx — NEW
export interface FlyoutProps {
  label: string;
  items: readonly { id: string; label: string }[];
  onPick: (id: string) => void;
  children: ReactNode;   // the trigger row
}

// src/presentation/components/library-overlay.tsx — NEW
export interface LibraryOverlayProps {
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  open: boolean;
  close: () => void;
  changeDiagram: (id: string) => void;
  openAtObject: (diagramId: string, label: string) => void;
  createDiagram: () => void;
  setDiagramStatus: (id: string, status: 'active' | 'archived') => void;
}

// src/presentation/shell/target-scale.ts — NEW (pure)
export type TargetSize = 'small' | 'medium' | 'large';
/** Screen-constant control sizes, in px, for one target-size preference. */
export function targetScale(size: TargetSize): {
  handle: number; dot: number; grab: number;
};

// src/presentation/edges/wire-shape.ts — NEW (pure)
export type WireShape = 'elbow' | 'straight' | 'curved' | 'stepped';
/** SVG path for one route under one shape. Deterministic; no DOM, no clock. */
export function wirePath(points: Point[], shape: WireShape, radius: number): string;

// src/presentation/shell/panel-accordion.ts — NEW (pure)
/** Which section is open, given the preference and the last toggle. */
export function resolveOpenSection(
  mode: 'accordion' | 'all-open',
  sections: readonly string[],
  toggled: string | null,
): (sectionId: string) => boolean;
```

Pure modules (`target-scale`, `wire-shape`, `panel-accordion`, existing `wire-routing`,
`rail-filter`, `rail-label`) carry the logic and are what the tests target. React components
stay thin.

---

## 8. Build slices

Six slices. **Hard limit 1 hour each.** At the hour the slice is sealed where it stands and
the remainder goes to backlog. Max 5 tests added per slice. Min 15 screenshots per slice,
including zoomed-in shots of individual controls.

| # | Slice | Musts | Files |
|---|---|---|---|
| 1 | Panel shell grammar + surface ladder | 8 | `tokens.css`, `shell.css`, `panel-section.tsx`, `panel-header.tsx`, `panel-accordion.ts` |
| 2 | Left panel: tabs, palette, library overlay | 9 | `rail.tsx`, `library-overlay.tsx`, `flyout.tsx`, `rail-filter.ts` |
| 3 | Right panel: progressive inspector | 9 | `inspect-panel.tsx`, `inspector.tsx`, `app-header.tsx` |
| 4 | Canvas hit targets at screen scale | 3, 4, 5 | `canvas.css`, `tokens.css`, `elbow-edge.tsx`, `target-scale.ts` |
| 5 | Wire authoring: drop-on-canvas, shapes, gate | 1, 6, 7 | `canvas-surface.tsx`, `wire-shape.ts`, `elbow-edge.tsx`, routing gate test |
| 6 | Settings surface + camera lock | 2 | `model.ts`, `defaults.ts`, `preferences-panel.tsx`, `preference-sections.ts` |

Each slice: implement → typecheck → its own tests → drive in browser → screenshots → seal.

## 9. Verification

- **One audit round maximum**, and only if used.
- **Minimum 15 screenshots per slice**, including per-control zoomed shots (a whole-panel
  shot does not count as inspecting the collapse toggle).
- **Maximum 5 tests per slice**, small, fast, isolated. No end-to-end suites.
- Every slice judged on two axes and both are reported: **logically correct** (does it do
  the thing) and **follows the design principle** (minimal, low-stimulation, spaced).
- `npx tsc --noEmit` clean, `npm run lint` clean, novakai-analytics ≥ 86 on new code.

## 10. Explicitly out of scope

Deferred to backlog, not built:

- Dangling wires with no target node (must 6 ships create-node-at-drop only).
- Mobile/tablet/responsive layouts. Canvas has one viewport.
- Keyboard shortcut system beyond the existing ⌘Z.
- Node kind re-assignment UI beyond the flyout picker and the wire inspector's kind select.
- Any change to the record schema, the CLI, or the JSON format.
- Multi-select, alignment tools, auto-layout changes.
- Search ranking changes beyond one-line truncation.
