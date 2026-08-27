> Historical only. For current instructions use `../../AGENTS.md` and `../architecture.md`.

# The Bench CSS modularisation plan

> **Status:** Implemented on `codex/the-bench-css-modularisation`.
> **Scope:** Restructure the original Bench CSS only. Preserve camera behaviour and all non-Bench work.

## Outcome

Replace the three catch-all stylesheets with cohesive style modules whose ownership is visible at the rendering module. Keep every CSS file at or below 300 physical lines, remove dead and repeated CSS, and preserve the intentional appearance and interactions of The Bench.

The 300-line ceiling is a navigability guard, not the architectural objective. The objective is locality: a maintainer changing one rendered module should find its presentation rules beside that module without learning unrelated selectors or relying on another module's import side effect.

## State diff

| Concern | Before | Implemented state |
|---|---|---|
| CSS shape | 4 files, 1,583 lines; `conversation.css` is 759 lines | 25 cohesive files, 1,444 lines; largest file is 148 lines |
| Ownership | Conversation, inspection, and overlay catch-alls own many unrelated rendered modules | Every selector has one named owner; shared rules have an explicit shared module |
| Imports | `ConversationNode` silently loads descendant styles; `MessageInspectorNode` silently loads related-object and wire styles | Rendering modules import their owned CSS directly; all catch-all manifests are deleted |
| Cascade | Effective compiled order is conversation → inspection → overlays → Bench state | Extraction first preserves that order; final owner styles do not override peer internals, and Bench orchestration remains explicitly last |
| Reuse | Shared control rules are broad selector lists; decision-form rules cross callers | Shared modules expose explicit classes; callers own layout wrappers while reusable modules own internals |
| Message inspection | `MessageRecord` renders a source handle styled from `inspection.css` | `MessageRecord` owns the record and handle presentation |
| Inspection nodes | Inspector and related-object presentation is bundled and loaded by the inspector | Each node owns its rules; a deliberately shared shell contains only their genuine common surface |
| Stacking | React Flow node layers and local CSS layers use overlapping, undocumented numbers | Global canvas/node layers and local stacking contexts are inventoried and kept semantically separate |
| Accessibility | Root and React Flow focus outlines are suppressed | Deliberate `:focus-visible` treatment is present and verified |
| Debt | 5 `!important`s, unused selectors/attributes, 7 unused tokens, repeated declaration blocks | Zero `!important`; zero known dead CSS/attributes/tokens; repeated facts have one owner |
| Verification | Manual camera check; no Bench-specific test files | 7 focused tests pass; dock, search, offscreen reveal, and replay prevention pass in-browser |
| Drift protection | No CSS architecture gate | Two automated cases enforce the ≤300-line and `!important` constraints |

## Plan revision diff

The reviewed plan differs from the first draft in these material ways:

1. File extraction and import-graph changes are separate phases and separate commits.
2. A temporary ordered stylesheet manifest preserves the existing cascade during extraction.
3. `MessageRecord`, `InlineDecisionForm`, and `RelatedObjectNode` receive explicit style ownership.
4. Inspector and related-object nodes may share only a small `InspectionNodeShell` module imported by both consumers.
5. Stacking contexts are inventoried before any z-index substitution; `--bench-layer-open` is deleted rather than reused for a local popover.
6. Camera preservation becomes repeatable test evidence rather than a manual assertion.
7. The visual baseline covers component states, reduced motion, and keyboard focus.
8. The 1,350–1,450 total-line goal is a stretch target; ownership, ≤300 lines, and zero known dead CSS are hard gates.
9. `npm run check` is required before and after. Existing unrelated failures are recorded at baseline; this work may introduce no new failures.
10. The line ceiling and `!important` ban receive automated drift guards.

## Ownership map

### Bench foundation

- `styles/tokens.css` — semantic Bench tokens only; no component geometry, state, or stacking policy.
- `styles/canvas.css` — root surface, React Flow normalization, field, scale, reduced motion, and root focus treatment.
- `styles/primitives.css` — small explicit visual classes used by at least two owners. It must not contain broad lists of component-private selectors.
- `styles/bench-state.css` — root orchestration such as Zen visibility. This remains explicitly imported last by `TheBench`.

### Conversation modules

- `ConversationNode.css`
- `ConversationCard.css`
- `ConversationThread.css`
- `MessageTranscript.css`
- `MessageRecord.css`, including its inspection source handle
- `MessageComposer.css`
- `ConversationFrameNode.css`
- `DraftConversationNode.css`
- `ConversationMenu.css`
- `DecisionRequestCallout.css`
- `InlineDecisionForm.css`

`MessageTranscript` owns scrolling, empty, and composing states. `MessageRecord` owns each message's content, relation actions, and handle. `InlineDecisionForm` owns its internal form presentation; callers provide a named wrapper for contextual sizing instead of reaching into form internals.

### Inspection modules

- `InspectionNodeShell.css` — only the surface shared by both inspection node types; imported by both consumers.
- `MessageInspectorNode.css`
- `RelatedObjectNode.css`
- `ObjectNodeBody.css`
- `InspectionWire.css`

### Overlay modules

- `BenchDock.css`
- `ConversationSearch.css`
- `ZenLayer.css`
- `BlockedAgentBanner.css`
- `OffscreenNodeMarker.css`

## Cascade and stacking contracts

### Cascade

During mechanical extraction, a temporary manifest imports extracted files in the exact existing compiled order:

1. conversation-derived rules;
2. inspection-derived rules;
3. overlay-derived rules;
4. Bench foundation and orchestration rules.

Computed styles and screenshots must match before any import moves. Owner imports then move one module at a time. In the final state:

- an owner may style its own class namespace;
- a caller may style its own layout wrapper, not a child's internal selectors;
- shared visual facts require an explicit shared class;
- peer owner styles must not depend on source order;
- `bench-state.css` is the only cross-module orchestration sheet and remains last.

### Stacking

Inventory each value by stacking context before editing it:

- React Flow node ordering: frame, closed conversation, open conversation, draft, related object, inspector;
- screen layers: scale, dock/offscreen, search, Zen;
- local layers: mission pool, menu popover, blocked banner, decision callout.

Numerically equal values in different contexts are not interchangeable tokens. In particular, the menu's local `z-index: 20` must not consume the React Flow open-node token. All seven currently unused tokens remain deletion candidates.

## Test budget (frozen by approval on 2026-08-19)

- `model/bench-interaction.test.ts`: at most five focused cases covering zoom-tier thresholds, focus/reveal/restore command contracts, and keyboard zoom limits.
- `the-bench-css-architecture.test.ts`: exactly two static architecture cases covering the 300-line ceiling and the `!important` ban.
- Browser verification: the state matrix below plus repeat-reveal behaviour through dock, search, and offscreen controls.
- No server-boot, PTY, sleep-based, snapshot-file, or unrelated regression tests are authorised by this plan.

Implementation precedes these tests, per the repository's default test workflow. Tests verify only the approved observable contracts above.

## Delivery sequence

### 1. Freeze behaviour

- Record the current `npm run check` result, including unrelated failures.
- Capture screenshots and critical computed styles for the state matrix below.
- Add focused tests for Bench zoom-tier policy and camera command construction.
- Add browser smoke coverage proving repeated reveal commands do not replay after a later pan or unrelated node update.

**Exit:** Baseline evidence is reproducible before CSS moves.

### 2. Inventory ownership and stacking

- Map every class selector to its rendering owner.
- Identify selectors spanning more than one owner.
- Classify every z-index as React Flow, screen, or local.
- Mark dead selectors, attributes, tokens, exact duplicate blocks, and all `!important` declarations.

**Exit:** Every current rule has a destination or an explicit deletion reason.

### 3. Mechanically extract behind fixed ordering

- Create the target CSS files without renaming selectors or consolidating declarations.
- Import them through the temporary ordered manifest.
- Preserve the current compiled cascade exactly.
- Do not move imports to rendering modules in this commit.

**Exit:** Screenshots and computed styles match the baseline; camera smoke still passes.

### 4. Establish direct ownership

- Move one stylesheet import at a time from the manifest to its rendering module.
- Add explicit ownership for `MessageRecord`, `InlineDecisionForm`, and `RelatedObjectNode`.
- Introduce the shared inspection shell only for rules genuinely consumed by both node types.
- Replace caller-to-child selector reach with caller-owned layout wrappers.
- Verify after each owner migration.

**Exit:** No rendered module depends on an unrelated module to load its CSS; the temporary manifest is deleted.

### 5. Remove debt without redesigning

- Delete dead selectors, DOM attributes, and all seven unused tokens.
- Remove every `!important` by correcting selector ownership/specificity.
- Consolidate exact repeated declaration blocks behind explicit shared classes where reuse is real.
- Restore intentional keyboard focus visibility.
- Keep stacking systems semantically separate.

**Exit:** Zero known dead CSS, zero `!important`, and no unintended visual regression.

### 6. Add architecture guards and seal

- Add an automated test that fails if a Bench CSS file exceeds 300 physical lines or contains `!important`.
- Run targeted tests and `npm run check`.
- Compare full-command output with the recorded baseline; no new failures are allowed.
- Re-run the browser state matrix and camera smoke against production-shaped data.

**Exit:** All hard gates below pass and final evidence is recorded.

## Browser state matrix

- resting cards at near, mid, and far zoom;
- open thread with unread, composing, empty, and populated transcript states;
- conversation menu open;
- decision callout and inline decision form;
- message inspector, related object, wire, and overlap with an open conversation;
- search open with results and empty results;
- Zen mode with and without blocked decision form;
- offscreen marker;
- reduced-motion preference;
- keyboard focus on root, nodes, controls, menu, search, and form fields;
- dock reveal, search reveal, and offscreen reveal;
- reveal the same target, pan away, reveal it again, then mutate/clear trails and confirm no replay.

## Hard gates

- No CSS file exceeds 300 physical lines.
- Every selector has one documented owner.
- No hidden CSS-loading dependency remains.
- No owner stylesheet reaches into a peer module's private internals.
- Zero `!important`.
- Zero known dead selectors, attributes, or tokens.
- Focus indicators are visible for keyboard interaction.
- Existing intentional visuals and interactions have no unintended regression.
- Camera reveal freshness and replay prevention pass targeted and browser verification.
- Total CSS is lower than the current 1,583 lines; 1,350–1,450 is the stretch target.
- `npm run check` introduces no new failure relative to the recorded baseline.

## Implementation evidence — 2026-08-19

- CSS reduced from 1,583 to 1,444 physical lines: 139 lines removed (8.8%).
- All 25 stylesheets are below the 300-line ceiling; the largest is `ObjectNodeBody.css` at 148 lines.
- All catch-all manifests and hidden style-loading dependencies were removed.
- Seven unused tokens, unused state attributes, the known dead selector, and all five `!important` declarations were removed.
- The resting, open-thread, menu, and inspection screenshots are byte-identical to their baselines. Search and Zen differ only by the intentional restored focus indicator.
- Far, mid, and near zoom states were verified at 0.40, 0.88, and 1.12 respectively. Blocked Zen and its expanded decision form were also verified.
- Re-revealing the same dock target after changing the viewport returned it to 0.88. Clearing trails then left the changed 0.76 viewport untouched, proving no stale camera replay. Search and offscreen-marker reveal paths also centered their targets at 0.88.
- The production fixture exposed unread and populated transcript states but no empty or composing instance. Their mechanically extracted selectors were preserved; synthetic application state was not introduced for the browser check.
- The seven approved Bench tests, lint, tools type-check, and production Vite build pass. `npm run check` still reaches the same unrelated baseline failure in `tools/report-session/agent-work-brief.test.ts` and then hangs during Vitest shutdown. App type-check still reports the two pre-existing Command Center and Missions errors.

## Commit boundaries

1. `test(messages): freeze Bench camera and visual contracts`
2. `refactor(messages): split Bench CSS behind stable cascade order`
3. `refactor(messages): isolate and clean Bench styles`
4. `test(messages): guard Bench CSS architecture`

The owner migration and debt removal are one implementation commit because explicit shared classes simultaneously establish ownership and eliminate the old cross-owner specificity. Mechanical extraction remains separate from that import-graph change.
