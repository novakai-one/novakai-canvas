# Novakai Canvas

Novakai Canvas is an editable diagram app with a CLI for agent-authored maps.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The server binds IPv6, so `127.0.0.1` does not work.

## Use the CLI

```bash
./canvas maps                         # list maps
./canvas flows <map>                  # list a map's named flows
./canvas read <map> --format dsl      # inspect one map
./canvas check [dsl-file]             # validate without writing
./canvas apply [dsl-file]             # create or replace maps
./canvas batch <map> [json-file]      # apply typed changes
./canvas rm <map> [node|zone]         # remove content or a map
./canvas snapshot <map> [-o out]      # write an SVG
./canvas help                         # DSL syntax
./canvas describe                     # typed command JSON
```

Use `./canvas`, not `npm run canvas`. See [AGENTS.md](AGENTS.md) for rules and examples.

## Data

- `public/data/library.json` lists diagrams.
- `public/data/diagrams/*.json` stores each diagram's meaning and layout.
- `public/data/canvas-preferences.json` stores app display choices.

Do not edit these files by hand. Use the app or CLI.

## Build

Import the reusable package only through `@novakai/canvas`, exported by
`packages/canvas/contract/index.ts`. See [docs/architecture.md](docs/architecture.md).

## Validate

```bash
npm run check
```
