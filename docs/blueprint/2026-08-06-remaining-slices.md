> Historical only. For current instructions use `../../AGENTS.md` and `../architecture.md`.

# Remaining slices — Chris's outstanding list

Continues `2026-08-06-selection-contract-and-p0-fixes.md`. Each slice is one commit, browser-verified
before it is claimed. Ordered by how many times Chris has raised it, then by payoff per unit effort.

## The list, as Chris stated it

| # | Chris's words | Slice |
|---|---|---|
| 1 | "I expected the present edit add undo to be in side panels" | S1 |
| 2 | "surprised that there is no way to add shapes like nodes and modules etc in the side panel" | S1 |
| 3 | "Left panel says filter not search. Not a true filter like Id expect from saas app" | S2 |
| 4 | "endless diagram list, many become unreadable if I shrink the panel… no other way to view except alphabetical" | S3 |
| 5 | "changes my selection without breadcrumbs" | S4 |
| 6 | "Cant edit the node title or body" on the canvas | S5 |
| 7 | "would need to conform to typescript or some standard so people don't write random stuff" | S6 |

---

## Outcome — all six slices landed

| Slice | Commit | Verified by |
|---|---|---|
| S1 studio owns create + undo | `fa07124` | toolbar down to Present/Edit/Saved; adding a Runtime from the panel takes 11 nodes → 12 and opens its Name field |
| S2 search, not filter | `781e5e3` | "broker" surfaces *Session broker — Agent Browser Sessions*; clicking selects `bs-broker` |
| S3 readable rail + Recent | `224b03c` | three Mission Control rows read as distinct tails at minimum width; Recent lists newest-first |
| S4 breadcrumbs | `7dd4a6e` | diagram › node › interface, and the trail walks back |
| S5 rename on the canvas | `2e922c3` | double-click renames on canvas and disk; Escape restores |
| S6 interfaces + signature rule | `50c6734` | invalid signature refused and marked; `AgentId, Frame[]` commits |

Final sweep: 12 behaviours green, no page errors. `src/` suites 328 passing, 1 pre-existing
`work-session-report` failure untouched.

### Two things found while doing this, fixed in passing

- `projectNodes` was never given `execute`, so node data had no way to change anything while
  `projectEdges` beside it always had. That asymmetry is why wires grew editing affordances over
  three lanes and nodes did not — and why S5 was impossible before it was fixed.
- `wire.update` / `interface.update` did not exist as record commands at all. The read-only wire
  and interface panels were not neglect; there was nothing to call.

### Deliberate deviation

Present/Edit stays over the canvas rather than moving into a side panel. It is a mode for the
canvas and the canvas is what it changes. Stated rather than done silently.

### Still open after these slices

- Wire ends can be moved to any port and stick, but a **new** wire's sides are only stored when
  React Flow reports a handle on the drop; a drop resolved without one still falls back.
- No create-on-canvas gesture. Double-click is now free for it, deliberately, but unbuilt.
- Node **descriptions** are still studio-only; S5 covers the title, not the body.
- Types have no structured editor — only interfaces gained one.
- Untested by me: marquee multi-select, ⌥-drag clone, copy/paste, alignment guides, the
  Theme/Nodes/Wires/Panel/Files preference tabs, and 18 of the 19 diagrams.

---

## S1 — The studio owns creating and undoing

**Why first:** raised twice (#1 and #2 are the same complaint from two directions). The floating
toolbar is also the last piece of the "three apps" chrome sitting over the canvas.

- Move **Add** and **Undo** out of the floating toolbar into the studio's diagram state, edit mode only.
- Add offers the same kinds it does today (Module, Object, Runtime, Resource, Group, Comment).
- A new object still lands at the viewport centre and becomes the selection, so the panel it was
  created from is already showing its record — create and name become one movement.
- Present/Edit stays where it is: it is a mode for the *canvas*, and the canvas is what it changes.
  Noting the deviation from Chris's words deliberately rather than silently.
- **Exit:** the toolbar over the canvas holds only mode and save state; a node can be created and
  named without the pointer leaving the studio.

## S2 — Search, not filter

- Rename to **Search** and make it reach **node labels as well as diagram names**.
- Results group under "Diagrams" and "Objects"; an object result travels to it and selects it.
- Empty query restores the plain list.
- **Exit:** typing a node's name finds the diagram it lives in and jumps to it.

## S3 — A rail that stays readable

- Raise the rail minimum width so rows never collapse to nothing; middle-truncate long names with
  the full name on hover.
- Sections: **Recent** (this sitting) above **All**, each with a count. Alphabetical inside All.
- **Exit:** at minimum width every row is still identifiable; the most recent diagrams are reachable
  without scrolling 19 rows.

## S4 — Breadcrumbs

The contract in the companion plan says navigate must leave a path back. It does not today.

- The studio header carries a trail: `Diagram › Object › Interface`, each step clickable.
- Selecting from a contents row, an endpoint chip or a type link pushes onto the trail.
- **Exit:** click a wire, then its endpoint, then that node's interface — and walk back up.

## S5 — Edit a node where it lives

- Double-click a node's title on the canvas edits it in place; Enter commits, Escape cancels.
- Same for the description line.
- **Exit:** a node can be renamed without opening the studio.

## S6 — A body that has to mean something

Chris: "would need to conform to typescript or some standard so people don't write random stuff."

- Interfaces and types get **structured** editing in the studio rather than free text: an interface
  is a name, accepted type names, returned type names; a type is a name and its fields.
- A signature is validated on entry — an identifier that is not a valid identifier is refused.
- **Exit:** an interface cannot be saved with a malformed signature, and what the canvas draws is
  always something the model can render.
