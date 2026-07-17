# Novakai Canvas

## Authoring maps (agents: start here)

Author maps only through the CLI — never hand-edit `public/data/*.json`;
layout is automatic, so never write coordinates.

```
./canvas maps                     list maps
./canvas read <map>               print a map as DSL (cheap context reload)
./canvas apply [dsl-file]         create/replace maps from DSL (file or stdin)
./canvas rm <map> [node]          remove a node or a whole map
./canvas snapshot <map> [-o out]  render a map to SVG
```

`./canvas help` prints the full DSL grammar. The one-screen version:

```
scope "My System"                              # a scope block FULLY declares that map
  note "Free-text remark."
  module "Session broker" "optional description"
    acquire(AgentId) -> SessionHandle          # methods: bare type names
    type Lease { agentId, ttl }
  runtime "Chrome instances"                   # kinds: module|object|runtime|resource
  wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]
```

Every wire needs its contract (the actual call it carries). Quote multi-word
names. Re-applying a scope replaces that map; other maps are untouched.

Use `./canvas`, not `npm run canvas` (npm swallows flags). The dev server
(`npm run dev`) binds IPv6 — open `http://localhost:5173`, not `127.0.0.1`.
The open app live-reloads when the CLI writes.

## Product rules

- Everything meaningful remains selectable.
- JSON owns architecture meaning.
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
