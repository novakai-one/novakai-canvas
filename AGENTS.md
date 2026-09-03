# Novakai Canvas

Canvas turns JSON records into editable diagrams.

## Use Canvas

- Run commands from the repo root with `./canvas`. Do not use `npm run canvas`; npm swallows flags.
- Data: `public/data/library.json` lists diagrams; `public/data/diagrams/*.json` stores meaning and layout; `public/data/canvas-preferences.json` stores display choices.
- Change those files only through the app or `./canvas`. Never write coordinates in DSL.
- `./canvas help` gives DSL syntax. `./canvas describe` lists command names; exact fields are in `packages/canvas/contract/workspace-commands.ts`.
- Run `./canvas read <map> --format dsl|agent|markdown|json` before changing a map.

Use DSL to replace a whole map, `batch` for small changes, the app for hand placement, and `check` before `apply`.

### Example: build a complete map

Write `/tmp/payments.canvas`:

```text
scope "Payments" orientation=left-right
  zone "Processing" layout=row gap=16
    module "API" palette=blue
    block "Approved" text=green background=green-soft weight=600
      line "Ready to settle"
  end
  resource "Ledger" palette=sage
  wire "API" -> "Ledger" color=blue width=medium : write(Payment) -> Receipt [executes]
  flow "Take payment" id=take-payment
    step 1 "payments--wire-1" "Write ledger"
  end
```

```bash
./canvas check /tmp/payments.canvas
./canvas apply /tmp/payments.canvas
./canvas read payments --format dsl
./canvas flows payments
```

This sets direction, group layout, colours, a wire, and a flow. `check` lays out without saving; `apply` saves and places new nodes; `flows` lists the flow and wire ID.

### Example: change one fact

Read the current `revision` with `./canvas read payments --format json`. If it is `4`, write `/tmp/change.json`:

```json
{"operationId":"rename-payments-v2","expectedRevision":4,"commands":[{"kind":"diagram.rename","name":"Payments v2"}]}
```

Run `./canvas batch payments /tmp/change.json`. `applied` means saved. `duplicate` means that
operation ID was already saved. On `conflict`, read again and rebuild the change. `rejected` means fix the command.

### Generate maps

`npm run -s deps:json | node tools/deps-to-dsl.mjs --nested | ./canvas apply` writes the folder map; omit `--nested` for the module map.
Mission maps come from `node tools/mission-view/translate.ts --root <Novakai-Command> | ./canvas apply`.

### Rules that prevent lost work

- A `scope` fully declares one map. Other maps are untouched.
- `apply` does not move existing nodes. Run `./canvas rm <map>` first only when a fresh layout is wanted.
- Removing a zone removes its contents. Removing a map fails while another map links to it.
- Reuse the same `operationId` when retrying the same batch. Use a new ID for a new change.
- A flow names existing wire IDs. It adds no nodes, wires, or layout.
- Option brackets such as `[orientation=...]` are not typed. Wire kinds such as `[executes]` are typed.

## Build Canvas

- CLI command or help: `packages/canvas/cli/`, `packages/canvas/core/authoring/cli-contract.ts`, CLI tests.
- Typed command: `packages/canvas/contract/workspace-commands.ts`, `packages/canvas/core/application/canvas-workspace/`, CLI discovery, tests.
- DSL or node kind: `packages/canvas/core/authoring/`, `packages/canvas/core/components/`, authoring tests.
- Public import: `packages/canvas/contract/index.ts`, `api.ts`, `compose.ts`, contract tests.
- Record or migration: `packages/canvas/contract/records/`, `packages/canvas/contract/schemas/`, `packages/canvas/core/domain/migrate/`, `tools/json-file-bridge.ts`.
- App interaction: `src/presentation/`; verify it in the shared browser.
- Generator: `tools/`, `package.json`, and the command list in this file.
- New UI component prototype: `src/presentation/prototype/rooms`.

Keep `./canvas help`, `./canvas describe`, public types, tests, and this route map consistent.
Current architecture is in `docs/architecture.md`.

## Product constraints

- Keep every meaningful object selectable.
- Diagram records own meaning. Layout records own coordinates. Preferences own display choices.

## Browser verification

- Read `~/.agents/browse/README.md` first.
- From `~/.agents/browse`, use only `node browse.mjs <command>`.
- Do not use repo Playwright, `playwright-cli`, or `npx playwright`.
- Inspect `latest.png`; keep evidence with `shot <name>`; finish with `node browse.mjs close`.
- The dev server binds IPv6. Open `http://localhost:5173`, not `127.0.0.1`.

## Finish

- Run `npm run check`.
- Check changed interactions in the browser.
- Verify saved JSON has the production schema.
