# Scenario: nvk mission CLI (small two-seat build)

**Status:** data drafted, not yet loaded into sandbox stores
**Author:** Claude
**Source:** `Novakai-Command/.novakai/stores/` — `mission_nvk-mission-cli` (real, done 2026-07-23, PR #51 merged)

## What it is

A **small, clean, two-seat mission** — the counterweight to the big five-agent ones.
One manager, one Fable worker, three tasks, zero issues, merged same day. Covers the
shapes big missions don't: a mission that just went well, a tiny team, no drama. Real
Chris quote as the kickoff message ("I want the CLI done").

## Copied vs invented

Copied: mission id/title/notes (incl. the verbatim Chris quote), both agent ids/names/session ids, all 3 task ids/titles, team id.
Adapted: priority "important" → "high". Invented: stages (derived from the 3 task titles), thread/message ids, artifact record (the flow diagram the real task names), run id; manager message bodies condensed from the real close-out notes.

## Data

Append each block to the matching file in `src/presentation/prototype/data/`.

### missions.jsonl

```jsonl
{"id":"mission_nvk-mission-cli","kind":"mission","ts":"2026-07-22T23:33:00Z","title":"nvk mission CLI: one verb filing a mission end-to-end through the store engine","status":"done","priority":"high","owner":"principal_chris","refs":[{"kind":"project","value":"proj_command"}],"created":"2026-07-22T23:33:00Z","updated":"2026-07-23T02:56:00Z","notes":"Scoped to ranked item 1 only; items 2-6 remain proposals. ACCEPTED; PR #51 merged by Chris same day."}
```

### teams.jsonl

```jsonl
{"id":"team_nvk-mission-cli","kind":"team","ts":"2026-07-22T23:35:00Z","name":"Team NVK Mission CLI","refs":[{"kind":"mission","value":"mission_nvk-mission-cli"}]}
```

### agents.jsonl

```jsonl
{"id":"agent_6e568fc9-0e1f-4527-a037-0b132ef7eee0","kind":"agent","ts":"2026-07-22T23:35:00Z","name":"Manager Kimi MissionCLI","provider":"kimi","status":"retired","sessionId":"session_763923e5-5612-43b7-909d-e991d5ced4b5","sessions":[],"refs":[{"kind":"mission","value":"mission_nvk-mission-cli"}],"updated":"2026-07-23T02:56:00Z"}
{"id":"agent_39d4bb78-b731-4e34-b922-b80a44de5251","kind":"agent","ts":"2026-07-22T23:40:00Z","name":"Worker Fable CLI","provider":"claude","status":"retired","sessionId":"99edabf5-29e8-48c1-8878-90e00a2aa317","sessions":[],"refs":[{"kind":"mission","value":"mission_nvk-mission-cli"}],"updated":"2026-07-23T02:40:00Z"}
```

### teamSeats.jsonl

```jsonl
{"teamSeatId":"seat_cli_manager","kind":"teamSeat","teamId":"team_nvk-mission-cli","roleProfileId":"role_orchestrator","agentId":"agent_6e568fc9-0e1f-4527-a037-0b132ef7eee0"}
{"teamSeatId":"seat_cli_worker","kind":"teamSeat","teamId":"team_nvk-mission-cli","roleProfileId":"role_builder","agentId":"agent_39d4bb78-b731-4e34-b922-b80a44de5251"}
```

### stages.jsonl

```jsonl
{"stageId":"stage_cli_01","kind":"stage","missionId":"mission_nvk-mission-cli","parentStageId":null,"title":"Plan gate","order":1,"status":"done","condition":"Plan approved; worker onboarded."}
{"stageId":"stage_cli_02","kind":"stage","missionId":"mission_nvk-mission-cli","parentStageId":null,"title":"Build the verb","order":2,"status":"done","condition":"scripts/nvk-mission.mjs create verb + tests; a real filing dogfooded."}
{"stageId":"stage_cli_03","kind":"stage","missionId":"mission_nvk-mission-cli","parentStageId":null,"title":"Flow diagram","order":3,"status":"done","condition":"Module-API wiring diagram: DSL source + rendered SVG in-repo."}
```

### tasks.jsonl

```jsonl
{"id":"task_mission-cli-manage","kind":"task","ts":"2026-07-22T23:35:00Z","title":"Manage the mission: plan gate, worker onboarding, independent verification, result.md","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cli_01"},{"kind":"role","value":"role_orchestrator"}],"created":"2026-07-22T23:35:00Z","updated":"2026-07-23T02:56:00Z","notes":""}
{"id":"task_mission-cli-verb","kind":"task","ts":"2026-07-23T00:00:00Z","title":"Build scripts/nvk-mission.mjs create verb + tests + doc listing lines; dogfood a real filing","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cli_02"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T00:00:00Z","updated":"2026-07-23T02:10:00Z","notes":""}
{"id":"task_mission-cli-diagram","kind":"task","ts":"2026-07-23T02:10:00Z","title":"Module-API flow diagram of the verb's wiring: DSL source + rendered SVG in-repo","status":"done","priority":"medium","refs":[{"kind":"stage","value":"stage_cli_03"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T02:10:00Z","updated":"2026-07-23T02:40:00Z","notes":""}
```

### threads.jsonl

```jsonl
{"id":"thread_nvk-mission-cli","kind":"thread","ts":"2026-07-22T23:33:00Z","roomId":"mission_nvk-mission-cli","refs":[{"kind":"mission","value":"mission_nvk-mission-cli"},{"kind":"agent","value":"agent_6e568fc9-0e1f-4527-a037-0b132ef7eee0"}]}
```

### messages.jsonl

```jsonl
{"messageId":"msg_cli_01","kind":"message","threadId":"thread_nvk-mission-cli","senderId":"principal_chris","body":"I want the CLI done. Scope is ranked item 1 only — items 2 to 6 stay proposals.","createdAt":"2026-07-22T23:33:00Z","refs":[]}
{"messageId":"msg_cli_02","kind":"message","threadId":"thread_nvk-mission-cli","senderId":"agent_6e568fc9-0e1f-4527-a037-0b132ef7eee0","body":"Verb landed and dogfooded — a real mission filed end-to-end through the store engine with validated refs. Diagram in-repo. PR #51 open.","createdAt":"2026-07-23T02:45:00Z","refs":[{"kind":"task","value":"task_mission-cli-verb"}]}
{"messageId":"msg_cli_03","kind":"message","threadId":"thread_nvk-mission-cli","senderId":"principal_chris","body":"Merged.","createdAt":"2026-07-23T02:56:00Z","refs":[]}
```

### artifacts.jsonl

```jsonl
{"id":"artifact_cli-flow-diagram","kind":"artifact","ts":"2026-07-23T02:40:00Z","title":"nvk-mission verb wiring diagram (DSL + SVG)","path":"docs/diagrams/nvk-mission-flow.svg","url":"","refs":[{"kind":"mission","value":"mission_nvk-mission-cli"},{"kind":"task","value":"task_mission-cli-diagram"}]}
```

### agentRuns.jsonl

```jsonl
{"agentRunId":"run_cli-worker","kind":"agentRun","agentId":"agent_39d4bb78-b731-4e34-b922-b80a44de5251","taskId":"task_mission-cli-verb","status":"succeeded","startedAt":"2026-07-23T00:00:00Z","endedAt":"2026-07-23T02:10:00Z"}
```
