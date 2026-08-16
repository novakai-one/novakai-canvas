# Scenario: Mission Control UX — nine findings to zero

**Status:** data drafted, not yet loaded into sandbox stores
**Author:** Claude (this scenario claimed here; Codex has its own tracker)
**Source:** `Novakai-Command/.novakai/stores/` — mission `mission_mission-control-ux` (real, closed 2026-07-23)

## What it is

A **completed** mission with a full team lifecycle — complements the sandbox's existing
active tunnel mission. Chris filed nine UX findings; a Kimi manager ran two workers and
two auditors through six stages; a mid-mission seat replacement happened (Worker Fable
at 590k context — ladder deviation); mission merged and team retired. Two issues stayed
open, including the famous "first row Chris clicked was a noop".

## Copied vs invented

| Copied (real)                                        | Invented / adapted                        |
| ---------------------------------------------------- | ----------------------------------------- |
| Mission id, title (trimmed), dates, close-out notes  | `priority: high` (real store said "important") |
| All 6 agent ids, names, providers, session ids       | Stage records (derived from real task titles) |
| All task ids + titles (8 of 11 kept)                 | Message bodies (condensed from real captains-log entries) |
| All 6 issue ids, titles, severities                  | Thread id, message ids, seat ids          |
| Artifact paths (from real mission refs)              | Evidence record shape (content from real issue) |

## Data

Append each block to the matching file in `src/presentation/prototype/data/`.

### missions.jsonl

```jsonl
{"id":"mission_control-ux","kind":"mission","ts":"2026-07-23T01:45:00Z","title":"Mission Control + Messages UX: nine Chris findings to zero","status":"done","priority":"high","owner":"principal_chris","refs":[{"kind":"project","value":"proj_command"}],"created":"2026-07-23T01:45:00Z","updated":"2026-07-23T07:46:00Z","notes":"Unify people lists on the object model, live-first left panel, archive closed work, show the Mission Object fully. ACCEPTED + MERGED (a2209adc). Team retired with honors."}
```

### teams.jsonl

```jsonl
{"id":"team_control-ux","kind":"team","ts":"2026-07-23T01:45:00Z","name":"Mission Control UX","refs":[{"kind":"mission","value":"mission_control-ux"}]}
```

### agents.jsonl

```jsonl
{"id":"agent_fa0d4893-5736-4f2d-b77f-7e5eeb126e36","kind":"agent","ts":"2026-07-23T01:50:00Z","name":"Manager Kimi UX","provider":"kimi","status":"retired","sessionId":"session_e7b5213d-7585-4cab-9089-a5f78624bfd2","sessions":[],"refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T07:46:00Z"}
{"id":"agent_050ee880-2fc6-4ce0-84a2-9bdb72cfb9df","kind":"agent","ts":"2026-07-23T02:05:00Z","name":"Worker Fable UX","provider":"claude","status":"retired","sessionId":"f166e6a8-77c5-4061-b0b7-4f3d1473b2b6","sessions":[],"refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T04:30:00Z"}
{"id":"agent_2e57e618-3ee1-49cc-ab9e-3f945afd5a5f","kind":"agent","ts":"2026-07-23T04:35:00Z","name":"Worker Kimi UX","provider":"kimi","status":"retired","sessionId":"session_b90cf22e-768c-4a0f-b2c6-6ca6a4c73809","sessions":[],"refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T07:46:00Z"}
{"id":"agent_762a28d2-34ff-4362-9a0b-227b01e366da","kind":"agent","ts":"2026-07-23T02:05:00Z","name":"Auditor Codex UX","provider":"codex","status":"retired","sessionId":"019f8ce0-bb3b-77c2-b027-f81c9cd00c44","sessions":[],"refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T04:40:00Z"}
{"id":"agent_4c3a4cba-9b91-4f2a-ba50-9cb13fb54fc9","kind":"agent","ts":"2026-07-23T04:42:00Z","name":"Auditor Codex UX II","provider":"codex","status":"retired","sessionId":"019f8dab-a130-7731-b729-db9db56d1495","sessions":[],"refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T07:46:00Z"}
```

### teamSeats.jsonl

```jsonl
{"teamSeatId":"seat_control-ux_manager","kind":"teamSeat","teamId":"team_control-ux","roleProfileId":"role_orchestrator","agentId":"agent_fa0d4893-5736-4f2d-b77f-7e5eeb126e36"}
{"teamSeatId":"seat_control-ux_worker1","kind":"teamSeat","teamId":"team_control-ux","roleProfileId":"role_builder","agentId":"agent_050ee880-2fc6-4ce0-84a2-9bdb72cfb9df"}
{"teamSeatId":"seat_control-ux_worker2","kind":"teamSeat","teamId":"team_control-ux","roleProfileId":"role_builder","agentId":"agent_2e57e618-3ee1-49cc-ab9e-3f945afd5a5f"}
{"teamSeatId":"seat_control-ux_auditor1","kind":"teamSeat","teamId":"team_control-ux","roleProfileId":"role_build-verifier","agentId":"agent_762a28d2-34ff-4362-9a0b-227b01e366da"}
{"teamSeatId":"seat_control-ux_auditor2","kind":"teamSeat","teamId":"team_control-ux","roleProfileId":"role_build-verifier","agentId":"agent_4c3a4cba-9b91-4f2a-ba50-9cb13fb54fc9"}
```

### stages.jsonl

```jsonl
{"stageId":"stage_cux_00","kind":"stage","missionId":"mission_control-ux","parentStageId":null,"title":"Rig","order":1,"status":"done","condition":"Worktree deps in, scratch ports probed, scratch stores seeded, browse smoke passes."}
{"stageId":"stage_cux_01","kind":"stage","missionId":"mission_control-ux","parentStageId":null,"title":"Diagnosis","order":2,"status":"done","condition":"BEFORE shots per component; findings #1-#9 root-caused against the durable object model."}
{"stageId":"stage_cux_02","kind":"stage","missionId":"mission_control-ux","parentStageId":null,"title":"Durable people source","order":3,"status":"done","condition":"Shared PersonView DTO; both rails on one agentId-keyed panel view-model."}
{"stageId":"stage_cux_03","kind":"stage","missionId":"mission_control-ux","parentStageId":null,"title":"Mission Room join","order":4,"status":"done","condition":"Membership, task-assignments, presence and doing-activity as four pure derivations with provenance."}
{"stageId":"stage_cux_04","kind":"stage","missionId":"mission_control-ux","parentStageId":null,"title":"Chief DM lane","order":5,"status":"done","condition":"Three recorded checks; lane verified in both rails; deviation recorded."}
{"stageId":"stage_cux_05","kind":"stage","missionId":"mission_control-ux","parentStageId":null,"title":"Archive read model","order":6,"status":"done","condition":"Backend projection + ArchivedLane DTO; four driven cases."}
{"stageId":"stage_cux_06","kind":"stage","missionId":"mission_control-ux","parentStageId":null,"title":"Finish line","order":7,"status":"done","condition":"Gates green unpiped, acting-as-Chris click-through, AFTER shots, PR open."}
```

### tasks.jsonl

```jsonl
{"id":"task_ux-manage","kind":"task","ts":"2026-07-23T01:50:00Z","title":"Manage the mission: plan gate, worker onboarding, independent verification, result.md","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cux_00"},{"kind":"role","value":"role_orchestrator"}],"created":"2026-07-23T01:50:00Z","updated":"2026-07-23T07:46:00Z","notes":""}
{"id":"task_ux-w-rig","kind":"task","ts":"2026-07-23T02:05:00Z","title":"Stage 0 rig: worktree deps, probed scratch ports, seeded scratch stores, browse smoke","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cux_00"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T02:05:00Z","updated":"2026-07-23T02:40:00Z","notes":""}
{"id":"task_ux-w-diagnosis","kind":"task","ts":"2026-07-23T02:40:00Z","title":"Stage 1 diagnosis bundle: BEFORE shots per component, item-level attention enumeration, issue filings","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cux_01"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T02:40:00Z","updated":"2026-07-23T03:30:00Z","notes":""}
{"id":"task_ux-w-people","kind":"task","ts":"2026-07-23T03:30:00Z","title":"Stage 2 durable people source: shared PersonView DTO, PeopleHub read API, both rails on one panel view-model","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cux_02"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T03:30:00Z","updated":"2026-07-23T05:10:00Z","notes":"Seat replaced mid-task: Worker Fable UX at 590k context; fresh Kimi worker continued from handoff.md."}
{"id":"task_ux-w-room","kind":"task","ts":"2026-07-23T04:40:00Z","title":"Stage 3 Mission Room join: four pure derivations with provenance; hide stage strip","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cux_03"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T04:40:00Z","updated":"2026-07-23T05:30:00Z","notes":""}
{"id":"task_ux-w-archive","kind":"task","ts":"2026-07-23T05:30:00Z","title":"Stage 5 archive read model: backend projection + ArchivedLane DTO, four driven cases","status":"done","priority":"medium","refs":[{"kind":"stage","value":"stage_cux_05"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T05:30:00Z","updated":"2026-07-23T06:30:00Z","notes":""}
{"id":"task_ux-w-finish","kind":"task","ts":"2026-07-23T06:30:00Z","title":"Stage 6 finish line: gates unpiped, acting-as-Chris click-through, AFTER shots, PR open","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cux_06"},{"kind":"role","value":"role_builder"}],"created":"2026-07-23T06:30:00Z","updated":"2026-07-23T07:30:00Z","notes":""}
{"id":"task_ux-verify","kind":"task","ts":"2026-07-23T06:45:00Z","title":"Finish-line verification: per-component before/after screenshots + click-through acting as Chris","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_cux_06"},{"kind":"role","value":"role_build-verifier"}],"created":"2026-07-23T06:45:00Z","updated":"2026-07-23T07:40:00Z","notes":""}
```

### issues.jsonl

```jsonl
{"id":"issue_mc-dm-row-click-noop","kind":"issue","ts":"2026-07-23T07:50:00Z","title":"Mission Control DM row click is a noop — observed by Chris on live lane, first row tried","status":"open","severity":"high","body":"After close-out, the first DM row Chris clicked on the live lane did nothing.","refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T07:50:00Z"}
{"id":"issue_act-as-chris-sampled","kind":"issue","ts":"2026-07-23T07:55:00Z","title":"PROCESS GAP: act-as-Chris verification accepted sampling where the Contract required exhaustive clicking","status":"open","severity":"high","body":"Representative sampling passed the gate; the first live click by Chris failed.","refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T07:55:00Z"}
{"id":"issue_chief-terminal-transcript-gap","kind":"issue","ts":"2026-07-23T05:10:00Z","title":"Chief-Chris terminal back-and-forth has no journal path — DM lane shows registered-onward traffic only","status":"open","severity":"medium","body":"Pre-registration terminal conversation is invisible to the DM lane.","refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T05:10:00Z"}
{"id":"issue_mission-artifact-blocks-unjoined","kind":"issue","ts":"2026-07-23T05:20:00Z","title":"Artifact store blocks with mission refs never join the Mission Room Evidence panel","status":"open","severity":"low","body":"Evidence panel only reads its own store; artifact blocks with mission refs are dropped.","refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T05:20:00Z"}
{"id":"issue_mission-room-raw-provenance","kind":"issue","ts":"2026-07-23T05:25:00Z","title":"Mission Room member rows render raw scratchpad store paths as provenance","status":"open","severity":"low","body":"Noisy and leaks local paths.","refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T05:25:00Z"}
{"id":"issue_mission-decision-refs-unrendered","kind":"issue","ts":"2026-07-23T05:30:00Z","title":"Mission decision refs are dangling-checked but never rendered as linked context in the Mission Room","status":"open","severity":"low","body":"Decisions exist on the mission record but the room never shows them.","refs":[{"kind":"mission","value":"mission_control-ux"}],"updated":"2026-07-23T05:30:00Z"}
```

### threads.jsonl

```jsonl
{"id":"thread_control-ux","kind":"thread","ts":"2026-07-23T04:20:00Z","roomId":"mission_control-ux","refs":[{"kind":"mission","value":"mission_control-ux"},{"kind":"agent","value":"agent_fa0d4893-5736-4f2d-b77f-7e5eeb126e36"}]}
```

### messages.jsonl

```jsonl
{"messageId":"msg_cux_01","kind":"message","threadId":"thread_control-ux","senderId":"principal_chris","body":"Replace Worker Fable UX — it's at 590k context. Workers were never meant to run Fable; that's senior tier only.","createdAt":"2026-07-23T04:20:00Z","refs":[{"kind":"agent","value":"agent_050ee880-2fc6-4ce0-84a2-9bdb72cfb9df"}]}
{"messageId":"msg_cux_02","kind":"message","threadId":"thread_control-ux","senderId":"agent_fa0d4893-5736-4f2d-b77f-7e5eeb126e36","body":"Replacement in flight. handoff.md into the packet, kill+archive with verified pid, fresh Kimi worker spawned and read-back gated. Mission continues from handoff, not scratch.","createdAt":"2026-07-23T04:28:00Z","refs":[{"kind":"task","value":"task_ux-w-people"}]}
{"messageId":"msg_cux_03","kind":"message","threadId":"thread_control-ux","senderId":"principal_chris","body":"Refresh the Auditor too. Same onboarding, cold eyes.","createdAt":"2026-07-23T04:32:00Z","refs":[]}
{"messageId":"msg_cux_04","kind":"message","threadId":"thread_control-ux","senderId":"agent_fa0d4893-5736-4f2d-b77f-7e5eeb126e36","body":"Both UX seats live. New Auditor onboarded onto plan-rulings.md; codex spawned from main checkout, staggered 2 min from the worker spawn.","createdAt":"2026-07-23T04:44:00Z","refs":[{"kind":"agent","value":"agent_4c3a4cba-9b91-4f2a-ba50-9cb13fb54fc9"}]}
{"messageId":"msg_cux_05","kind":"message","threadId":"thread_control-ux","senderId":"agent_fa0d4893-5736-4f2d-b77f-7e5eeb126e36","body":"Part 5 complete except one brake item. tsc 0, house lint 201 PASS, build green, fence exact at 32 files.","createdAt":"2026-07-23T07:20:00Z","refs":[{"kind":"task","value":"task_ux-w-finish"}]}
{"messageId":"msg_cux_06","kind":"message","threadId":"thread_control-ux","senderId":"principal_chris","body":"First DM row I clicked on live did nothing. Filed as high — and the click-through was meant to be exhaustive, not sampled.","createdAt":"2026-07-23T07:52:00Z","refs":[{"kind":"issue","value":"issue_mc-dm-row-click-noop"}]}
```

### artifacts.jsonl

```jsonl
{"id":"artifact_cux-brief","kind":"artifact","ts":"2026-07-23T01:48:00Z","title":"Mission Contract","path":".novakai/work/mission_control-ux/brief.md","url":"","refs":[{"kind":"mission","value":"mission_control-ux"}]}
{"id":"artifact_cux-diagnosis","kind":"artifact","ts":"2026-07-23T03:25:00Z","title":"Diagnosis bundle: findings #1-#9 root-caused","path":".novakai/work/mission_control-ux/diagnosis.md","url":"","refs":[{"kind":"mission","value":"mission_control-ux"},{"kind":"task","value":"task_ux-w-diagnosis"}]}
{"id":"artifact_cux-object-gap","kind":"artifact","ts":"2026-07-23T03:28:00Z","title":"Mission Object vs app gap answer","path":".novakai/work/mission_control-ux/mission-object-vs-app.md","url":"","refs":[{"kind":"mission","value":"mission_control-ux"}]}
{"id":"artifact_cux-after-shots","kind":"artifact","ts":"2026-07-23T07:30:00Z","title":"AFTER screenshots, per component","path":".novakai/work/mission_control-ux/shots/after/","url":"","refs":[{"kind":"mission","value":"mission_control-ux"},{"kind":"task","value":"task_ux-verify"}]}
```

### evidence.jsonl

```jsonl
{"evidenceId":"evidence_cux-clickthrough","kind":"evidence","claim":"Every Mission Control control was clicked acting as Chris before close-out.","method":"Browser click-through on the scratch lane, per-component before/after screenshots.","result":"Sampling accepted where the Contract required exhaustive clicking. First live click by Chris (a DM row) was a noop.","refs":[{"kind":"mission","value":"mission_control-ux"},{"kind":"task","value":"task_ux-verify"},{"kind":"artifact","value":"artifact_cux-after-shots"}]}
```

### agentRuns.jsonl

```jsonl
{"agentRunId":"run_cux-worker-02","kind":"agentRun","agentId":"agent_2e57e618-3ee1-49cc-ab9e-3f945afd5a5f","taskId":"task_ux-w-people","status":"succeeded","startedAt":"2026-07-23T04:35:00Z","endedAt":"2026-07-23T05:10:00Z"}
{"agentRunId":"run_cux-auditor-02","kind":"agentRun","agentId":"agent_4c3a4cba-9b91-4f2a-ba50-9cb13fb54fc9","taskId":"task_ux-verify","status":"succeeded","startedAt":"2026-07-23T04:42:00Z","endedAt":"2026-07-23T07:40:00Z"}
```
