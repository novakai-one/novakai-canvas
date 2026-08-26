Creating New Prototypes.

New UI Component prototypes are to be created in /src/presentation/prototype/rooms

## Browser verification

- Read `~/.agents/browse/README.md` before the first browser check.
- Use only the shared browser driver: `node ~/.agents/browse/browse.mjs <command>`.
- Run browser commands with the working directory set to `~/.agents/browse`.
- Do not use, install, or invoke repo-local Playwright, `playwright-cli`, or `npx playwright`.
- Inspect `~/.agents/browse/latest.png`; preserve evidence with `shot <name>`.
- Finish with `node browse.mjs close`. The watchdog closes forgotten headless sessions after 15 idle minutes.
- When several agents are active, take turns using the shared browser because it drives one canonical page.

---
# Novakai Canvas

## Authoring maps (agents: start here)

Author maps only through the CLI — never hand-edit `public/data/*.json`;
layout is automatic, so never write coordinates.

```
./canvas maps                     list maps
./canvas flows <map>              list named flows and their ordered wire IDs
./canvas read <map>               print a map as DSL (cheap context reload)
./canvas apply [dsl-file]         create/replace maps from DSL (file or stdin)
./canvas rm <map> [node]          remove a node or a whole map
./canvas snapshot <map> [-o out]  render a map to SVG
```

`./canvas help` prints the full DSL grammar. The one-screen version:

```
scope "My System" [orientation=top-down|left-right]   # a scope block FULLY declares that map
  note "Free-text remark."
  module "Session broker" "optional description"
    acquire(AgentId) -> SessionHandle          # methods: bare type names
    type Lease { agentId, ttl }
  runtime "Chrome instances"                   # kinds: module|object|runtime|resource
  zone "Stores" [crossing=gated|free] [gate="Node"] ... end
                                                 # boundary attributes are optional
  wire "browse CLI" -> "Session broker.acquire" : acquire(AgentId) -> SessionHandle [queries]
  flow "Acquire a session"
    step 1 "my-system--wire-1"             # references existing wire IDs only
  end
```

In the grammar above, square brackets mean "optional" — never type the
brackets. Write `band=0`, not `[band=0]` (the CLI rejects the bracketed form).

`apply` places only brand-new nodes. Nodes that already exist on the map never
move, so a layout someone arranged by hand survives every apply. To lay a whole
map out fresh: `./canvas rm <map>`, then `apply`.

Every wire needs its contract (the actual call it carries). Quote multi-word
names and `"Module.method"` port endpoints. Re-applying a scope replaces that
map; other maps are untouched. Flows add no graph objects or geometry; select
one in the app to emphasise its existing wires, or choose Structure only.

Use `./canvas`, not `npm run canvas` (npm swallows flags). The dev server
(`npm run dev`) binds IPv6 — open `http://localhost:5173`, not `127.0.0.1`.
The open app live-reloads when the CLI writes.

## Product rules

- Everything meaningful remains selectable.
- JSON owns architecture meaning.
- Layout records own coordinates; semantic nodes never do.
- Preferences own presentation choices.
- Canvas objects explain themselves.
- Visual styling stays restrained.
- Never introduce neon colours.

## Design rules

- Keep modules cohesive.
- Minimise dependency direction.
- Hide implementations behind small interfaces.
- Keep impure work at adapters.
- Keep domain transformations pure.
- Store each fact once.
- Prefer composition over inheritance.
- Avoid speculative abstractions.
- Document exported declarations directly.
- Test through module interfaces.

## Completion

- Run `npm run check`.
- Inspect interactions in a real browser.
- Verify production-shaped JSON.
