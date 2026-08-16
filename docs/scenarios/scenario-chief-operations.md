# Scenario: Chief operations (standing mission)

**Status:** data drafted, not yet loaded into sandbox stores
**Author:** Claude
**Source:** `Novakai-Command/.novakai/stores/` — `mission_chief-operations` (real, standing, status "doing")

## What it is

A **standing, never-finishing mission** — the terminal-spawned Chief session itself:
registration, visibility, orchestration continuity. Covers the UI shapes the two done
missions don't: an active mission with **no task list**, a lineage of successive chief
agents (5 → 6 → 7), one live agent, and open process-culture issues ("too many yes-men",
"patching over root cause"). Sparse on purpose: no stages, no runs, no artifacts —
standing operations, not a build.

## Copied vs invented

Copied: mission id/title/notes, all agent ids/names/session ids, all 3 issue ids/titles/severities.
Adapted: mission status "doing" → "active"; chief-kimi-7 marked live (store says retired — a live current chief reads truer day-to-day); one duplicate chief-kimi-5 record dropped; team consolidated to one record. Invented: thread/message ids; message bodies condensed from the real issue bodies and mission notes.

## Data

Append each block to the matching file in `src/presentation/prototype/data/`.
Id keys follow each store's own convention (`id`, `messageId`, …), same as existing sandbox rows.

### missions.jsonl

```jsonl
{"id":"mission_chief-operations","kind":"mission","ts":"2026-07-23T05:00:00Z","title":"Chief operations (standing): registration, visibility, and orchestration continuity","status":"active","priority":"high","owner":"principal_chris","refs":[{"kind":"project","value":"proj_command"}],"created":"2026-07-23T05:00:00Z","updated":"2026-08-16T01:15:00Z","notes":"Standing mission so terminal-spawned chiefs register into the object model and stay visible in-app with a DM lane. No end state."}
```

### teams.jsonl

```jsonl
{"id":"team_chief-operations","kind":"team","ts":"2026-07-23T05:00:00Z","name":"Chief lineage","refs":[{"kind":"mission","value":"mission_chief-operations"}]}
```

### agents.jsonl

```jsonl
{"id":"agent_70352f78-3994-4d09-be8a-02749b26891e","kind":"agent","ts":"2026-07-23T05:10:00Z","name":"chief-kimi-5","provider":"kimi","status":"retired","sessionId":"session_75fd6e2d-c0a4-48b4-afdf-c463e32055e6","sessions":[],"refs":[{"kind":"mission","value":"mission_chief-operations"}],"updated":"2026-07-24T10:00:00Z"}
{"id":"agent_8a51ab56-9f1a-47cf-9751-7f9cfb16cb13","kind":"agent","ts":"2026-07-24T10:05:00Z","name":"chief-kimi-6","provider":"kimi","status":"retired","sessionId":"session_60f04d58-24c8-42a0-964c-2bceb0419602","sessions":[],"refs":[{"kind":"mission","value":"mission_chief-operations"}],"updated":"2026-08-02T09:00:00Z"}
{"id":"agent_bba1cbab-b99c-41d5-acfb-cded266687c0","kind":"agent","ts":"2026-08-02T09:05:00Z","name":"chief-kimi-7","provider":"kimi","status":"live","sessionId":"session_a0895dac-4169-4199-b112-30ce0102a4da","sessions":[],"refs":[{"kind":"mission","value":"mission_chief-operations"}],"updated":"2026-08-16T01:15:00Z"}
{"id":"agent_052c05a4-d9f1-4d74-af99-5efcf4225455","kind":"agent","ts":"2026-07-23T05:00:00Z","name":"nvk-watchdog","provider":"ops","status":"spawning","sessionId":null,"sessions":[],"refs":[{"kind":"mission","value":"mission_chief-operations"}],"updated":"2026-08-16T01:15:00Z"}
```

### issues.jsonl

```jsonl
{"id":"issue_yes-men-management-layers","kind":"issue","ts":"2026-08-10T08:00:00Z","title":"Too many yes-men in the chain — management layers approve the same thing without adding independent judgement","status":"open","severity":"high","body":"Each layer rubber-stamps the previous one; no seat is rewarded for disagreeing.","refs":[{"kind":"mission","value":"mission_chief-operations"}],"updated":"2026-08-10T08:00:00Z"}
{"id":"issue_patching-over-root-cause","kind":"issue","ts":"2026-08-10T08:05:00Z","title":"Plans and fixes often patch symptoms instead of fixing root cause","status":"open","severity":"high","body":"Patching bad engineering rather than proposing the proper fix.","refs":[{"kind":"mission","value":"mission_chief-operations"}],"updated":"2026-08-10T08:05:00Z"}
{"id":"issue_worker-usage-token-oversight","kind":"issue","ts":"2026-08-08T07:00:00Z","title":"No process for monitoring worker usage and tokens — oversight is manual only","status":"open","severity":"medium","body":"Nobody notices a worker burning context until it hits the wall.","refs":[{"kind":"mission","value":"mission_chief-operations"}],"updated":"2026-08-08T07:00:00Z"}
```

### threads.jsonl

```jsonl
{"id":"thread_chief-operations","kind":"thread","ts":"2026-08-16T01:00:00Z","roomId":"mission_chief-operations","refs":[{"kind":"mission","value":"mission_chief-operations"},{"kind":"agent","value":"agent_bba1cbab-b99c-41d5-acfb-cded266687c0"}]}
```

### messages.jsonl

```jsonl
{"messageId":"msg_chiefops_01","kind":"message","threadId":"thread_chief-operations","senderId":"principal_chris","body":"Before you spawn the next team: the last two plans patched symptoms. I want the proper fix proposed even if it's bigger.","createdAt":"2026-08-16T01:02:00Z","refs":[{"kind":"issue","value":"issue_patching-over-root-cause"}]}
{"messageId":"msg_chiefops_02","kind":"message","threadId":"thread_chief-operations","senderId":"agent_bba1cbab-b99c-41d5-acfb-cded266687c0","body":"Understood. Also flagging: manager and auditor approved the same plan with identical wording again. Filing it against the yes-men issue.","createdAt":"2026-08-16T01:09:00Z","refs":[{"kind":"issue","value":"issue_yes-men-management-layers"}]}
{"messageId":"msg_chiefops_03","kind":"message","threadId":"thread_chief-operations","senderId":"principal_chris","body":"Good. And keep an eye on worker context — nobody caught the last one until 590k.","createdAt":"2026-08-16T01:12:00Z","refs":[{"kind":"issue","value":"issue_worker-usage-token-oversight"}]}
```
