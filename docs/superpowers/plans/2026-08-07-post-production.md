> Historical only. For current instructions use `../../../AGENTS.md` and `../../architecture.md`.

# Post-production — canvas gesture + rename fixes (branch fix/canvas-gesture-rename)

Date: 2026-08-07. Scope delivered: drag preview, resize anchor, batched resize undo, diagram rename + naming at creation, save-integrity fix, title-field draft editing. All findings below are DEFERRED — none were in scope.

## User-reported, deferred

1. **Wire storm on group resize.** Resizing a group re-routes and flashes wires and wire labels even though the nodes inside don't move. Likely mechanism: each in-flight size frame re-runs the full projection (including wire routing) against a changing obstacle set, so routes churn per frame. Fix direction: freeze wire routing during an active resize gesture, or route from settled geometry only. Visible and unpleasant; not data-corrupting.

## Same-class follow-ups found by review

2. `canvas-library.ts`: `create()`, `setStatus()`, `remove()` still discard `commitIndex` outcomes — the same tear class as the save bug fixed in d80febd. A failed index commit there reports success and no dirty marker heals it.
3. `setStatus()` rewrites an open diagram's record without coordinating with the workspace; a later workspace save silently reverts the status on disk.
4. A torn diagram opened and saved with no edit reports 'written' without healing the stale index entry (heals on the next real edit — acceptable, noted for completeness).
5. Two overlapping autosaves of the same session can surface a false "File changed on disk" (any stale-revision maps to the external-edit message, including conflict with our own in-flight save). Pre-existing class; the index retry widens the window marginally.

## Interaction polish

6. Wires don't follow a node during drag preview — the box moves, wires catch up on drop. Cosmetic.
7. The on-canvas root-frame rename (double-click) updates only the caption, never the diagram name — the two rename doors disagree. Pre-existing, more visible now that the panel door renames both.
8. Per-keystroke text fields (description, wire label) burn one revision per character; >50 keystrokes evicts the whole undo history (canvas-workspace.ts:344 history cap).
9. Escape does not cancel a drag (it steps selection outward; the gesture continues). Decide intent.
10. Reload opens the alphabetically-first diagram, not the last-open one (src/main.tsx:84).
11. Resize handles are hard to hit at fit zoom (~0.33): sub-pixel edge lines, ports covering edge midpoints, corner handles hittable only on their inner quadrant.

## Older findings from the original diagnosis (verify still true on main before scheduling)

12. Wire corridor (waypoint) shaping has no live preview: `shaping` state is computed per pointermove in elbow-edge.tsx but never fed to the route memo; the wire jumps on release.
13. `obstacles` are computed per wire in projection.ts but never consumed by ElbowEdge — "wires route around nodes" doesn't actually render.
14. Live-reload when the CLI writes is broken: the `novakai:data-changed` event has no consumer since the record-model rewrite, so AGENTS.md's "the open app live-reloads when the CLI writes" is currently untrue.
15. `canvas-engine.ts` `describe()` omits `diagram.rename` — reviewed as arguably correct (legacy v2 engine never receives v3 workspace commands); confirm intent.

## Analytics (novakai-analytics)

- Base (f2703cc): **64**. Final (branch tip): **64** — no regression. Reds (pre-existing): complexity 7, giantFiles 22, deadExports 45, interfaceClarity 46. Ambers: cycles 75, giantFunctions 65.
- New code held to the >88 standard: in-flight.ts is a small pure documented module; the save fix added no new exports; all new seams tested.
- Path to >88 for the repo: start at `src/presentation/projection.ts` and `src/presentation/canvas-actions.ts` (giant functions, dead exports 17.2% repo-wide). That is a dedicated refactor slice, not a bug-fix add-on.

## Test-infra notes

- `tools/report-session/report-session.test.ts` has load-sensitive 15s timeouts (fail under parallel load, pass in isolation).
- Vitest prints "close timed out after 10000ms" / hanging-process notice on exit — environmental, pre-existing.
