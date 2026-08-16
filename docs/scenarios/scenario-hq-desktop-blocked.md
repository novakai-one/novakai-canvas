# Scenario: Desktop tasks not showing (blocked / handed off)

**Status:** data drafted, not yet loaded into sandbox stores
**Author:** Claude
**Source:** `Novakai-Command/.novakai/stores/` — `mission_hq-desktop-tasks-not-showing` (real, status "todo")

## What it is

The **smallest scenario on purpose**: a mission that never got a team. Root cause was
found (packaged desktop app reads an unseeded userData dir, so a missing store renders
as empty) but the fix is owned by another session, so the work sits as a todo mission
with one refiled task and one handoff task. Covers the empty/blocked states: mission
with no agents, no stages, no messages — exactly what a real backlog row looks like.

## Copied vs invented

Copied: mission id, title (trimmed), status, root-cause note, both task ids, the handoff task title.
Adapted: the refiled task had a null title in the real store — given its mission's title as the task title. Invented: timestamps rounded, priority "low".

## Data

Append each block to the matching file in `src/presentation/prototype/data/`.
No team, agent, stage, thread, or message records — the empty state is the point.

### missions.jsonl

```jsonl
{"id":"mission_hq-desktop-tasks-not-showing","kind":"mission","ts":"2026-07-24T09:00:00Z","title":"Desktop app: tasks not rendering in the packaged build","status":"todo","priority":"low","owner":"principal_chris","refs":[{"kind":"project","value":"proj_command"}],"created":"2026-07-24T09:00:00Z","updated":"2026-08-05T10:00:00Z","notes":"ROOT CAUSE FOUND: packaged app reads an unseeded userData data dir — a missing store renders as empty. Fix owned by another session; waiting on the patch handoff."}
```

### tasks.jsonl

```jsonl
{"id":"task_hq-desktop-tasks-not-showing","kind":"task","ts":"2026-07-24T09:00:00Z","title":"Desktop app: tasks not rendering in the packaged build","status":"refiled","priority":"low","refs":[{"kind":"mission","value":"mission_hq-desktop-tasks-not-showing"}],"created":"2026-07-24T09:00:00Z","updated":"2026-08-05T10:00:00Z","notes":"Refiled once root cause moved the fix into another session's patch."}
{"id":"task_docs-packaged-patch-handoff","kind":"task","ts":"2026-08-05T10:00:00Z","title":"Apply docs/patches/packaged-storesdir.patch to electron/main.ts (owned by other session) so the packaged app resolves .novakai/stores","status":"todo","priority":"low","refs":[{"kind":"mission","value":"mission_hq-desktop-tasks-not-showing"}],"created":"2026-08-05T10:00:00Z","updated":"2026-08-05T10:00:00Z","notes":""}
```
