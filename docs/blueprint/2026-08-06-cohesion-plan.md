# Cohesion plan — one app, not three

> **Status:** PLAN — awaiting Chris's approval before any implementation.
> Responds to Chris's review of the experience lane (2026-08-06, verbatim below).
> Reference: the calm-pass observer remains the 6/10 floor.

## Chris's review, verbatim

> "There are no panel toggles to collapse panels." *(they exist — two glyphs in the floating
> toolbar, mid-screen, nowhere near the panels; verified. A control nobody can find is a
> control that does not exist.)*

> "The left panel is an endless diagram list, many become unreadable if I shrink the panel
> size to smaller width - no other way to view the diagrams except by alphabetical order?"

> "Left panel says filter not search. Not a true filter like Id expect from saas app."

> "I expected the present edit add undo to be in side panels."

> "The wire ports dont allow me to change ports, I drop it on bottom port, no change. Only 2
> ports is weird top and bottom."

> "Well done on the group select/deselect and removing the boundary."

> "it feels like 3 different apps almost."

> "I clicked on inspector for an interface and it looks pretty sad on right design panel."

> "I think you need to write a plan first before implementing"

> "none of this was in the known rough edges so it becomes a surprise."

## Diagnosis

Each lane shipped its region to spec; no one owned the whole surface. Three dialects remain
on screen at once: the new rail/studio, the leftover floating toolbar, and React Flow's own
zoom cluster + legend. Two studio states (interface, type) were never designed. Ports were
built as a data model, not an experience.

## The target, one picture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⇤  >_ novakai Canvas          [ Present | Edit ]          Saved              ⇥  │ 48px header
├───────────────┬──────────────────────────────────────────────────┬───────────────┤
│ RAIL          │                                                  │ STUDIO        │
│ Search…       │                                                  │ ┌───────────┐ │
│               │                CANVAS                            │ │ kind/title│ │
│ PINNED        │                                                  │ │ meta    ✕ │ │
│ ▸ …           │         (nothing floats over it                  │ ├───────────┤ │
│ RECENT        │          except its own objects)                 │ │ tabs      │ │
│ ▸ …           │                                                  │ ├───────────┤ │
│ ALL        18 │                                                  │ │ designed  │ │
│ ▸ …           │                                                  │ │ body for  │ │
│               │                                                  │ │ EVERY kind│ │
│ ARCHIVED    1 │                                                  │ │           │ │
│               │  ─────────────────────────────────────────────   │ │ [Undo]    │ │
│ + New diagram │   − ⊡ +      zoom/fit, tokens-styled    legend ▸ │ │ [+ Add]   │ │
└───────────────┴──────────────────────────────────────────────────┴───────────────┘
  ⇤ toggle lives ON the header edge above its panel — like the observer.
```

## Workstreams (in order; each is small and separately approvable)

### W-1 One chrome — kill the floating toolbar
- A full-width 48px header: collapse toggle at each end (adjacent to its panel, matched
  icons, exactly like the observer), wordmark left, `Present | Edit` centre, save status
  quiet right.
- **Undo and + Add move into the Studio** (Chris: "present edit add undo in side panels"):
  a persistent actions row in the Studio's diagram state and object states, edit mode only.
- React Flow's Controls cluster replaced by a tokens-styled zoom/fit group, bottom-centre
  of the canvas. Legend becomes a collapsed chip that expands on hover/click.
- Exit: no floating chrome over the canvas except canvas content; every control findable by
  looking at the region it affects.

### W-1b Camera law hardens (Chris, 2026-08-06)
> "I dont want things to automatically change my view focus / zoom -> Put that setting in
> the right panel, maybe someone will like it."
- The automatic re-fit on panel resize/collapse (lead integration, `32f0818`) becomes
  **opt-in**: default is the camera never moves except by the user's own zoom/pan/fit or an
  explicit travel. New preference "Re-frame when panels move", default off, in Preferences.
- Exit: collapse/resize panels with the setting off — the viewport transform is
  byte-identical before and after.

### W-2 The rail becomes a library, not a list
- "Filter" → **Search**: searches diagram names AND node labels; Enter jumps to the first
  match (travel + centre on node); results grouped "Diagrams / Objects".
- Sections: **Pinned** (persisted preference), **Recent** (session, last 5), **All**,
  **Archived** — counts on each; All stays alphabetical inside itself.
- Narrow widths: middle-truncation with full-name tooltip; raise rail minimum to 220px so
  rows never become unreadable.
- Exit: a 19-diagram library is navigable without scrolling the full list; search reaches
  nodes; nothing unreadable at minimum width.

### W-3 Every studio state designed (the "sad inspector" fix)
- One content grammar for ALL selection kinds: kind tag / title / context line, then
  sections of real FieldRows — never bare label-text pairs.
- INTERFACE state: signature as a proper card (name, owner as a clickable peek chip,
  Accepts/Returns as typed rows with kind tags), description editable, "used by N wires".
- TYPE state: same treatment. WIRE state: label text becomes editable (closes the label
  gap), kind as a segmented choice, endpoints as peek chips.
- Exit: select one of each kind (diagram, group, module, object, runtime, resource, comment,
  interface, type, wire) — every state reads as designed by the same hand; screenshot per
  state, read for spacing and consistency.

### W-4 Ports that mean something
- Four connection sides per node (N/S/E/W), rendered as quiet dots on hover/selection.
- Dropping a wire end on a specific side sets `preferredSide` (schema already stores it);
  the router honours it; dropping on a different port of the SAME node re-anchors instead
  of no-op (Chris's exact reproduction).
- Exit: drag a wire end to each side of a node and watch it stick; router respects the
  chosen side across all 18 diagrams with the routing gate still at zero crossings.

### W-5 Cohesion audit pass (the "3 apps" test)
- After W-1..4: one sweep comparing every region against tokens — spacing, type, radius,
  icon weight, motion. Fix drift in place.
- Exit: a full-app screenshot set where rail, header, canvas chrome, and studio read as one
  instrument; Chris's own click-through as the final gate.

## Process corrections (binding on me)
1. Plan before build for anything user-facing — this document is the template.
2. The chat close-out lists **every** known issue verbatim from the build log — never a
   subset. A surprise rough edge is a reporting failure even when the log recorded it.
3. Every lane's exit includes "findable by a fresh user" for any control it moves or adds.
```

### Also discovered (2026-08-06, from Chris's session diff)
- The browser save path writes diagram records as single-line compact JSON, destroying
  git-diffability. Pretty-print (2-space, trailing newline) must be restored in the bridge
  write path. Slots into W-1 as a correctness fix.
