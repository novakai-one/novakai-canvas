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

- Architecture JSON stores meaning and layout.
- Preferences JSON stores visual choices.
- Selection remains transient interface state.

## Verification

Pure domain behaviour uses fabricated fixtures.

Browser verification covers selection, creation, and persistence.
