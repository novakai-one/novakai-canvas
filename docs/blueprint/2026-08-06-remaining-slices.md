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
