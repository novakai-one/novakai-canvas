# Novakai Canvas

Selectable architecture maps backed by editable JSON.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (the server binds IPv6 — `127.0.0.1` refuses).

## Author maps from the terminal

```bash
./canvas maps                     # list maps
./canvas read <map>               # print a map as DSL
./canvas apply [dsl-file]         # create/replace maps from DSL (file or stdin)
./canvas rm <map> [node]          # remove a node or a whole map
./canvas snapshot <map> [-o out]  # render a map to SVG
```

`./canvas help` prints the DSL grammar. Layout is automatic; the open app
live-reloads when the CLI writes. See `AGENTS.md` for the authoring contract.

## Data

- `public/data/project-architecture.json` owns map meaning.
- `public/data/canvas-preferences.json` owns presentation preferences.

Canvas edits write back through the development file adapter. Never edit the
data files by hand — go through the app or the CLI.

## Validate

```bash
npm run check
```

This runs linting, tests, typechecking, and production building.
