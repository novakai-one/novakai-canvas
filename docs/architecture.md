# Architecture

## Decision

Novakai Canvas uses a headless JSON domain.

React Flow remains a replaceable presentation adapter.

## Dependency direction

```text
presentation → application → domain
adapters ────────────────→ application
```

The domain imports no framework or browser code.

## Deep module

`CanvasEngine` exposes five operations:

- Read one snapshot.
- Execute one command.
- Replace one document.
- Save current state.
- Subscribe to changes.

It hides mutation, revisioning, publication, and persistence.

## Persistence seam

`JsonRepository<T>` owns storage variability.

The current adapter writes development JSON files.

Future adapters may target desktop or cloud storage.

## Data separation

- Semantic nodes and wires store what the diagram means.
- Saved layouts separately own node geometry and small wire-routing hints.
- Edit and Present read the same selected layout; mode never substitutes another arrangement.
- Preferences JSON stores visual choices.
- Selection remains transient interface state.

Schema-1 documents migrate at the validation seam: existing node geometry becomes
the `layout-default` layout without changing IDs, meaning, coordinates, or revision.
New saves use schema 2.

## Verification

Pure domain behaviour uses fabricated fixtures.

Browser verification covers selection, creation, and persistence.
