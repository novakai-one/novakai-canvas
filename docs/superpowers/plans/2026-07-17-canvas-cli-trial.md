# Canvas CLI — zero-context agent trial results (2026-07-17)

**Setup:** a fresh general-purpose agent was given only the worktree path and a
5-module system spec ("Webhook Relay"), told to author it "using whatever
tooling the repo provides — discover it yourself", and to report every command,
error, and attempt. No mention of `./canvas`, the DSL, or AGENTS.md.

**Result: first-attempt success, zero errors.**

- Discovery path: `ls` + `package.json` → `AGENTS.md` ("agents: start here"
  section) → `./canvas help` → wrote DSL → `./canvas apply`.
- Commands to green: 1 apply. Total commands including discovery + verify: ~8.
- Errors hit: none.
- Verification the agent chose itself: `canvas maps`, `canvas read` (round-trip),
  `canvas snapshot` + reading the SVG, `git status` (confirmed only the data
  file changed).
- Friction reported: none material. The only judgment calls were wire-kind
  choices (`[queries]` vs `[assigns]`), which is by design.
- Live behaviour: the open app at localhost:5174 live-reloaded to the trial's
  revision (r592) with the new map rendered — no manual reload.

Compared against the pre-CLI baseline (session 31ec29a8: hand-written JSON
mutation scripts, coordinate math, autosave fights, IPv6 confusion, ~30+ turns
with repeated browser verification), this is the intended two-command flow:
`apply`, then `snapshot`/`read` for eyes.

No fixes were required after the trial, so no second run was needed. The
trial's "Webhook Relay" map is committed as a living example.
