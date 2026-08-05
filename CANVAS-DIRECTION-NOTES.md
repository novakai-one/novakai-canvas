# Novakai Canvas — Product Direction and Engineering Decisions

> **Status:** Proposed agent notes — **not laws, not a ratified specification, and not authority to build**
>
> **Author:** Codex (OpenAI)
>
> **Date:** 2026-08-05 (Australia/Melbourne)
>
> **Product intent supplied by:** Christopher Dasca

This document preserves the decisions reached in the 2026-08-05 conversation so a future builder does not have to reinterpret the transcript. It deliberately separates Chris's product intent from Codex's proposed engineering decisions.

## Mission contract

**Outcome:** Leave one findable document that explains the intended Novakai Canvas product, the proposed engineering shape, the roadmap, and the finish lines well enough for another builder to continue without inventing missing meaning.

**Operating mode:** Documentation build. Make executive decisions where the conversation leaves implementation detail open. Do not ratify requirements or implement the product in this pass.

**In scope:** Product boundary; human and AI authoring model; diagram organisation; semantic, layout, routing, hierarchy, history, and integration decisions; staged roadmap; diagrams; evidence from the current repository.

**Out of scope:** Code changes, migration work, UI polish, a new Build Spec, merge to `main`, or changes to Chris's dirty working tree.

**Done means:** Authorship and status are explicit; current facts and proposals are not mixed; Chris's stated intent is preserved; the roadmap has testable milestone exits; Mermaid diagrams parse when a local renderer is available; the work is committed on an isolated branch; a temporary recovery handoff points back here.

**Fallback rule:** If detail is missing, record the smallest reversible assumption and continue. Do not hold an endless prose audit.

## Who authored what

### Christopher Dasca — product intent

The following came from Chris in the conversation on 2026-08-05. These are short verbatim statements because wording matters:

> "I want to create diagrams on the canvas."

> "I want AI to be able to create diagrams."

> "I want control over node locations, layouts."

Chris also described these expected behaviours in his own examples:

- A human can add, move, resize, edit, group, connect, reconnect, and remove things as naturally as in an ordinary canvas tool.
- AI can create useful diagrams without manually calculating every coordinate.
- Auto-layout can clean only a selected branch or group while leaving the other 95% exactly where it was.
- The canvas supports different node types, different depths of explanation, hierarchy, and clustering.
- Diagrams can be created, saved, found, revisited, and related to deeper diagrams.
- Edit and Present must not show contradictory arrangements of the same diagram.
- The useful reason Present existed — making hierarchy readable without asking AI to hand-place everything — must not be lost.

These statements are **accepted conversational direction**, not a claim that Chris authored the data model or implementation design below.

### Codex — proposed decisions

Every item labelled **Decision** in this document is Codex's proposal on 2026-08-05, derived from Chris's intent and the inspected code. Chris did not author these technical details. They remain changeable until Chris accepts them or a later specification ratifies them.

## Skills applied in this pass

- **Compile Mission Brief:** bounded the work and supplied the fallback rule above.
- **Handoff:** requires a durable recovery point and an explicit temporary handoff for a disconnected session.
- **Elite Codebase Engineering:** keeps the domain application-agnostic, defines deep public contracts, and plans migration as vertical slices.
- **Engineering Standards:** checks coupling, cohesion, separation of concerns, information hiding, dependency direction, DRY, YAGNI, least surprise, and composability.
- **Create Architecture Diagrams:** keeps proposed architecture separate from observed facts and gives every diagram a question and takeaway.

**Not applied:** Build Spec. This is intentionally a set of agent notes, not the mandatory ratified Novakai specification process.

## Current repository evidence

The isolated documentation worktree starts from `main` at commit `e020be1`. The earlier UX review also inspected the running prototype and branch at commit `31792d1`. Where branches differ, the code in `e020be1` is the repository evidence for this document.

Observed in the current worktree:

- `src/domain/model.ts` stores semantic node data and `position`/`size` in the same `ArchitectureDocument`.
- `src/domain/maps.ts` creates Present mode by running `layoutScopes` over a focused copy. Stored Edit coordinates remain unchanged.
- `src/App.tsx` chooses that derived Present document when mode is `present`.
- `src/domain/commands.ts` has one whole-scope layout command, `scope.layout`; it has no arbitrary selected-slice contract.
- `src/application/canvas-engine.ts` is already a useful framework-free seam for snapshot, command execution, persistence, and subscriptions.
- `AGENTS.md` already tells agents to use the CLI and avoid writing coordinates manually.

Plain-language diagnosis: **the app currently stores one arrangement, then Present silently creates another.** This explains why editing a layout can appear to be ignored when the user switches modes. It also shows that the CLI/automatic-layout direction is valuable and should be evolved rather than discarded.

## Product boundary

### What Novakai Canvas is

Novakai Canvas is a shared visual workspace where a human and an AI can create, understand, and revise the same structured diagrams. It is for codebase maps, system flows, operations, explanations, and related visual thinking. It runs standalone now, but its public capability should later embed in the wider Novakai application without a rewrite.

### What it is not

- It is not a Figma replacement or a pixel-perfect drawing package.
- It is not merely a Mermaid renderer.
- It is not a system where AI is expected to be good at coordinate arithmetic.
- It is not an auto-layout engine that silently takes ownership of the whole drawing.
- It is not two competing diagrams called Edit and Present.
- It is not an infinite plugin platform or every imaginable node type in the first release.
- It is not a microservice. The current need is one composable local capability with adapters.

## One-sentence product promise

**People decide what the diagram means and may place anything manually; AI describes structure through safe commands; Canvas turns that shared meaning into a readable layout without destroying intentional work.**

