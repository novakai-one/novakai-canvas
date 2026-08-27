# Current architecture

This file describes shipped code. Historical plans do not.

## Supported entry points

- App: `src/App.tsx`
- CLI: `./canvas` and `packages/canvas/cli/canvas.ts`
- Reusable package: `@novakai/canvas`
- Public exports: `packages/canvas/contract/index.ts`

Do not import files below `packages/canvas/core/` from another package or host.

## Code direction

```text
app, CLI, or host
        |
packages/canvas/contract
        |
packages/canvas/core
        |
repository port -> file, memory, or object-store adapter
```

`core` holds app actions, diagram rules, layout, routing, DSL parsing, and exports.
`contract` is the stable path into that code. `src/presentation` connects it to React Flow.

## Main records

- `LibraryIndex` lists diagrams and links between diagrams.
- `DiagramRecord` stores one diagram's nodes, wires, flows, views, layouts, revision, and saved operations.
- `CanvasLibrary` creates, opens, lists, saves, and removes diagrams.
- `CanvasWorkspace` reads and changes one diagram.

All current library and diagram records use schema version 3.

## Saved files

```text
public/data/library.json               diagram index and cross-diagram links
public/data/diagrams/<diagram-id>.json one DiagramRecord
public/data/canvas-preferences.json    app display choices
```

Diagram records own meaning and layout. Preferences do not own diagram meaning.
`project-architecture.pre-v3.json` exists for migration and compatibility. It is not current storage.

## Changes

A `RecordChangeSet` contains an operation ID, expected revision, timestamp, and ordered commands.
Canvas applies all commands or none. Results are `applied`, `duplicate`, `conflict`, or `rejected`.
The same operation ID is safe to retry. A stale revision cannot overwrite a newer record.

DSL input compiles to the same records and commands. Existing placement survives `apply`.
The app writes through the development file bridge. External CLI writes trigger app reload.

## Update paths

- Public types and functions: `packages/canvas/contract/`
- Diagram rules: `packages/canvas/core/domain/`
- Workspace actions: `packages/canvas/core/application/`
- DSL and CLI help: `packages/canvas/core/authoring/`
- File and host adapters: `packages/canvas/adapters/` and `tools/json-file-bridge.ts`
- React UI: `src/presentation/`

Keep storage, public contracts, CLI discovery, tests, and `AGENTS.md` in sync.
