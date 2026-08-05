# Canvas Experience Requirements — the missing gate

> **Status:** Chris's experience requirements, captured 2026-08-06. These bind the same way
> R1–R7 bind. The capability blueprint measured the engine; this measures the cockpit.
> No UI lane ships while any of these fail in a real browser.

## Chris's pain points, verbatim (2026-08-06)

> "I also expect layout to use a left and right panel for organisation. resizeable, fully collapsable."

> "Clicking around is annoying. If I zoom into a large diagram, select a node you would think I click into the open space to deselect, but instead it selects the group. The groupings play a role, but they block user experience when trying to deselect."

> "Moving around the canvas is difficult."

> "Moving wire from one port to another is not possible."

> "Wires often overlap making it confusing."

> "What goes on the left panel and right inspector panel has not been thought out - no one has designed the user experience."

> "If I want to deselect the selected thing esc does nothing."

> "The fonts are now inconsistent. Use inter."

> "The layout of the panel is very inconsistent right panel body and header structure changes for each option."

> "Wires travel through nodes that they arent related to -> Massive problem."

> "Wires cant be moved."

> "No control over labels."

> "I cant draw anywhere on canvas. I tried adding a module - wont allow me to go outside the existing group boundary so not a true canvas experience."

> "The current UI UX is not been intentionally designed."

> "There is no rail structure in left panel and no thought into right panel studio."

From earlier in the same conversation:

> "I havent even seen the app working effectively yet. Your milestones make it sound not far away, but the UI UX is not good."

## Reference build

`novakai-build-observer`, worktree `.claude/worktrees/observer-calm-pass` (source is on
`main` at `6e9c2d7`; the main checkout's `dist/` was stale — rebuild before judging).
Chris's rating: **6/10 — "NOT perfect… could be drastically improved," but the floor.**
What earns the 6: rail organised by meaning with counts, collapsible/resizable panels with
matched toggle icons, a Studio inspector with a stable header and tab structure
(Inspect / Evidence / Look), calm chrome after the "calm pass" (one type system, no gold
flood, no pills), peek-vs-travel selection that doesn't jump the workspace.

## The design laws these imply

**Shell**
1. Three-region studio: left rail, dominant canvas, right Studio inspector. Both side
   panels drag-resizable and fully collapsible, calm motion, pushing the canvas — never
   covering it.
2. The rail is organised by meaning (grouped sections, counts, filter at top). A rail row
   is navigation: clicking travels. Peek (inspect without moving the workspace) and travel
   (move the workspace) are distinct, deliberate acts.
3. The Studio has ONE skeleton — identical header and body structure for every selection
   kind. Only the fields change, never the layout.
4. Inter everywhere. Mono only for the wordmark and real terminal output. One type system.

**Canvas**
5. True canvas: you can draw and place anywhere. Groups carry meaning but are never walls —
   adding or moving a node is never clamped to a group boundary; membership changes by
   where you land, not by where you're allowed to go.
6. Deselection is sacred: click on empty space deselects — it must never select the
   enclosing group. Esc always deselects (or steps selection outward: node → group →
   nothing). Groups are selected by their title, not their interior.
7. Moving around is effortless: every diagram opens fitted and readable; camera is
   remembered per diagram; fit/zoom always one gesture away; Find finds nodes and centres
   them.

**Wires**
8. Wires never travel through nodes they aren't related to. Routing avoids unrelated
   nodes; parallel wires spread instead of overlapping.
9. Wires are directly manipulable: drag an endpoint to another port (identity preserved),
   drag the path to shape it (waypoints), and labels are controllable — positioned by the
   human, attached to their wire, never smearing into neighbours.
10. Wires are legible at working density. Faint is the dimmed state, not the default.

**Discipline**
11. Every screen obeys amber scarcity: one gold signal, everything else quiet.
12. None of this is done until it has been driven in a real browser the way Chris would
    drive it — and it feels intentional, not merely functional.
