---
target: Novakai Canvas app UI (src/presentation)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-05T19-49-52Z
slug: src-presentation
---
# Novakai Canvas — UX Critique (src/presentation)

Method: dual-agent (A: design review via real-browser clickthrough, 23 shots · B: deterministic detector) + lead's own 7-screenshot clickthrough.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Save status only exists in Edit mode; Present gives no persistence feedback |
| 2 | Match System / Real World | 3 | Domain vocabulary good; "Find" actually filters the diagram picker, not the canvas |
| 3 | User Control and Freedom | 2 | Undo button-only, no Cmd+Z, no Redo; Backspace deletes into autosave; Archive is a bare select option |
| 4 | Consistency and Standards | 2 | Find mislabeled; "+ Add"/"Diagram…" are native selects cosplaying as menus |
| 5 | Error Prevention | 2 | Three unconfirmed destructive paths (Backspace, Delete object, Archive), one-way undo as only net |
| 6 | Recognition Rather Than Recall | 3 | Contents list is excellent, but row click selects without panning to the node |
| 7 | Flexibility and Efficiency | 1 | Zero shortcuts; no fit-view on diagram switch; viewport resets on mode toggle |
| 8 | Aesthetic and Minimalist Design | 3 | Canvas calm and disciplined; Preferences floods 7 gold accents; legend overlays content |
| 9 | Error Recovery | 2 | No explanation of disabled Undo; failure presentation untested |
| 10 | Help and Documentation | 2 | Wire-kind legend is the only teaching; no affordance hints anywhere |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

Authored, not interchangeable — ~80% on-brand. The canvas is unmistakably Novakai: near-monochrome node chrome, mono-caps kind tags, gold on the selected node, selection-dimming that manages attention wordlessly. The Preferences panel breaks character (gold flood, cream slider tracks) and the toolbar's native selects leak OS chrome. Deterministic scan: canvas UI mechanically clean; all 5 genuine detector findings are in the out-of-scope work-session-report.css (side-tab/accent-border patterns). Inter "overuse" flags are false positives (brand-mandated).

## Overall Impression

The capability is real and the visual language is already Novakai — but nobody has designed the experience, only implemented the engine. Every session starts with a rescue operation (illegible thumbnail viewport, invisible wires) before any real work begins.

## What's Working

1. Selection-dimming focus model — the whole canvas exhales when you select; pure show-don't-tell.
2. Contents list as the empty-selection inspector state — dead space turned into navigation.
3. Node card typography — kind tags, bolded interface signatures; best-in-genre at readable zoom.

## Priority Issues

- **[P0] Wires illegible at working density** — `stroke: var(--faint)` on `#0d0d0f` vanishes; parallel-edge labels smear into run-ons; "missing" dotted kind indistinguishable from "queries". The product's stated purpose is wire control; you cannot control what you cannot see. Fix: raise base wire contrast one step, label halos, stagger parallel labels; reserve faint for the dimmed state.
- **[P0] No wayfinding** — no fit-view on diagram switch (new diagram arrives as a postage stamp, sometimes clipped off-screen), viewport resets on mode toggle, Find doesn't find nodes, contents-row click doesn't navigate. Fix: fitView on switch and mode change; Find searches nodes with Enter-to-cycle-and-center; row click pans/zooms.
- **[P1] Destructive actions one keystroke deep with a one-way net** — Backspace/Delete-object/Archive all unconfirmed into autosave; no Redo, no Cmd+Z. Fix: Cmd+Z/Cmd+Shift+Z + Redo; second gesture for Archive; destructive styling on Delete.
- **[P1] Selection dim can stick** — after Undo the canvas stayed dimmed with nothing selected (lead's clickthrough, shot 07).
- **[P2] Preferences panel violates amber scarcity** — up to 7 simultaneous gold accents, cream slider tracks. Fix: ink-toned controls, gold only on the active thumb.
- **[P3] Present mode reads as "everything disabled"** — dimmed toolbar makes Edit look unavailable; Add-select snaps back forcing full round-trips per add; diagram name shown twice in toolbar.

## Persona Red Flags

**Alex (power user):** Cmd+Z does nothing; every diagram switch costs a manual re-frame ×18 diagrams; Find+Enter appears broken; undo-spam habit destroys work (no redo).
**Sam (keyboard/a11y):** tab strip not a tablist; Preferences unreachable in Present with no announcement; no h1/landmark for current diagram; Backspace deletion with no confirm and no aria-live announcement; near-invisible slider tracks.

## Minor Observations

Legend has no backdrop and collides with dense diagrams; Georgia serif comment nodes markedly less legible at small zoom; inconsistent diagram id naming leaks into data-ids; node body text ~6-7px at default zoom on load.

## Questions to Consider

1. Where does the AI co-author's activity show on the canvas? The revision counter is the only trace of "someone else was here."
2. Should Present share a camera with Edit, or have per-view staged framing?
3. Gold currently means "the thing you selected." Should it instead be reserved for drift/missing wires — the product's actual alarm?
