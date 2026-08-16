# Scenario: External session visibility

**Status:** data drafted, not yet loaded into sandbox stores
**Author:** Claude
**Source:** `Novakai-Command/.novakai/stores/` — `mission_external-session-visibility` (real, done 2026-07-23)

## What it is

A **done mission with a real test subject**: terminal-spawned chiefs were invisible in
Mission Control; this mission registered them into the object model so they appear as DM
lanes. Five agents including a mid-mission manager replacement and the chief
(`chief-kimi-2`) that served as the live test subject. Six tasks, all done; six issues
found during diagnosis and left open — the mission fixed visibility, the issues are the
residue it uncovered.

## Copied vs invented

Copied: mission id/title/notes; 5 agent ids/names/session ids; all 6 task ids/titles; all 6 issue ids/titles.
Adapted: severities normalized to the sandbox vocabulary ("moderate" → "medium", null → "medium"); the two duplicate-named managers kept as-is (it was a real replacement); team consolidated to one record. Invented: stages (derived one-to-one from the real task titles), thread/message ids, run ids; message bodies condensed from the real mission notes.

## Data

Append each block to the matching file in `src/presentation/prototype/data/`.
Not every agent has a run and not every stage has a message — sparse coverage is intentional and matches the real store.

### missions.jsonl

```jsonl
{"id":"mission_external-session-visibility","kind":"mission","ts":"2026-07-22T21:25:00Z","title":"External session visibility: terminal-spawned sessions appear as DM lanes in Mission Control","status":"done","priority":"high","owner":"principal_chris","refs":[{"kind":"project","value":"proj_command"}],"created":"2026-07-22T21:25:00Z","updated":"2026-07-23T00:02:00Z","notes":"Chris: terminal-spawned chief invisible in Mission Control; fix it. Test subject: chief-kimi-2. Diagnosis + issue filings, no scope creep."}
```

### teams.jsonl

```jsonl
{"id":"team_external-session-visibility","kind":"team","ts":"2026-07-22T22:05:00Z","name":"Team External Session Visibility","refs":[{"kind":"mission","value":"mission_external-session-visibility"}]}
```

### agents.jsonl

```jsonl
{"id":"agent_2787285a-d7ae-4ba9-912f-a5b74f138f97","kind":"agent","ts":"2026-07-22T22:05:00Z","name":"Manager Kimi Visibility","provider":"kimi","status":"retired","sessionId":"session_9c572e22-5776-422a-a485-3c9209b11219","sessions":[],"refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-22T23:10:00Z"}
{"id":"agent_7698bef8-6493-4672-a648-ce3fba573d5a","kind":"agent","ts":"2026-07-22T23:12:00Z","name":"Manager Kimi Visibility","provider":"kimi","status":"retired","sessionId":"session_2224b1fd-9bf8-4de6-810a-036d989c4a10","sessions":[],"refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-23T00:02:00Z"}
{"id":"agent_29b00827-e3ad-498f-bcd9-2567cfbd9e0b","kind":"agent","ts":"2026-07-22T22:10:00Z","name":"Worker Kimi Visibility","provider":"kimi","status":"retired","sessionId":"session_cc05ff11-9a2f-40a6-9687-537cf6d96e3d","sessions":[],"refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-23T00:00:00Z"}
{"id":"agent_38f4706c-705a-40fe-a757-71c84b719d3d","kind":"agent","ts":"2026-07-22T22:10:00Z","name":"Auditor Claude Visibility","provider":"claude","status":"retired","sessionId":"43fe8c49-fe66-4164-8717-85c111a888cf","sessions":[],"refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-23T00:01:00Z"}
{"id":"agent_af3afde6-3bcd-4c49-ac84-6dc071ed6008","kind":"agent","ts":"2026-07-22T21:30:00Z","name":"chief-kimi-2","provider":"kimi","status":"retired","sessionId":"session_c8d39318-a59a-4eb2-bb66-a1d4d3916292","sessions":[],"refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-23T00:02:00Z"}
```

### teamSeats.jsonl

```jsonl
{"teamSeatId":"seat_vis_manager","kind":"teamSeat","teamId":"team_external-session-visibility","roleProfileId":"role_orchestrator","agentId":"agent_7698bef8-6493-4672-a648-ce3fba573d5a"}
{"teamSeatId":"seat_vis_worker","kind":"teamSeat","teamId":"team_external-session-visibility","roleProfileId":"role_builder","agentId":"agent_29b00827-e3ad-498f-bcd9-2567cfbd9e0b"}
{"teamSeatId":"seat_vis_auditor","kind":"teamSeat","teamId":"team_external-session-visibility","roleProfileId":"role_build-verifier","agentId":"agent_38f4706c-705a-40fe-a757-71c84b719d3d"}
```

### stages.jsonl

```jsonl
{"stageId":"stage_vis_01","kind":"stage","missionId":"mission_external-session-visibility","parentStageId":null,"title":"Plan","order":1,"status":"done","condition":"plan.md visual-first and audited."}
{"stageId":"stage_vis_02","kind":"stage","missionId":"mission_external-session-visibility","parentStageId":null,"title":"Backend registration path","order":2,"status":"done","condition":"Object model verb + API registers an external session."}
{"stageId":"stage_vis_03","kind":"stage","missionId":"mission_external-session-visibility","parentStageId":null,"title":"DM lane rendering","order":3,"status":"done","condition":"Durable registered sessions render as DM lanes in Mission Control."}
{"stageId":"stage_vis_04","kind":"stage","missionId":"mission_external-session-visibility","parentStageId":null,"title":"Live proof","order":4,"status":"done","condition":"chief-kimi-2 registered, 2-way messaging shown, browser screenshots."}
{"stageId":"stage_vis_05","kind":"stage","missionId":"mission_external-session-visibility","parentStageId":null,"title":"Diagnosis + filings","order":5,"status":"done","condition":"Per-gap issue filings, including other-chief-mission visibility."}
{"stageId":"stage_vis_06","kind":"stage","missionId":"mission_external-session-visibility","parentStageId":null,"title":"Gates + PR","order":6,"status":"done","condition":"Gate chain green unpiped, PR open for Chris."}
```

### tasks.jsonl

```jsonl
{"id":"task_vis-plan","kind":"task","ts":"2026-07-22T22:05:00Z","title":"Mission plan (plan.md, visual-first, audited)","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_vis_01"},{"kind":"role","value":"role_orchestrator"}],"created":"2026-07-22T22:05:00Z","updated":"2026-07-22T22:30:00Z","notes":""}
{"id":"task_vis-backend-registration","kind":"task","ts":"2026-07-22T22:30:00Z","title":"Backend registration path for external sessions (object model verb + API)","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_vis_02"},{"kind":"role","value":"role_builder"}],"created":"2026-07-22T22:30:00Z","updated":"2026-07-22T23:05:00Z","notes":""}
{"id":"task_vis-dm-visibility","kind":"task","ts":"2026-07-22T23:05:00Z","title":"Frontend: durable registered sessions render as DM lanes in Mission Control","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_vis_03"},{"kind":"role","value":"role_builder"}],"created":"2026-07-22T23:05:00Z","updated":"2026-07-22T23:30:00Z","notes":""}
{"id":"task_vis-live-proof","kind":"task","ts":"2026-07-22T23:30:00Z","title":"Live proof on chief-kimi-2: registration, 2-way messaging, browser screenshots","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_vis_04"},{"kind":"role","value":"role_builder"}],"created":"2026-07-22T23:30:00Z","updated":"2026-07-22T23:50:00Z","notes":""}
{"id":"task_vis-diagnosis","kind":"task","ts":"2026-07-22T23:30:00Z","title":"Diagnosis write-up + per-gap issue filings (incl. other-chief-mission visibility)","status":"done","priority":"medium","refs":[{"kind":"stage","value":"stage_vis_05"},{"kind":"role","value":"role_build-verifier"}],"created":"2026-07-22T23:30:00Z","updated":"2026-07-23T00:00:00Z","notes":""}
{"id":"task_vis-gates-pr","kind":"task","ts":"2026-07-23T00:00:00Z","title":"Gate chain green unpiped + PR open for Chris","status":"done","priority":"high","refs":[{"kind":"stage","value":"stage_vis_06"},{"kind":"role","value":"role_orchestrator"}],"created":"2026-07-23T00:00:00Z","updated":"2026-07-23T00:02:00Z","notes":""}
```

### issues.jsonl

```jsonl
{"id":"issue_simultaneous-spawn-session-attach-race","kind":"issue","ts":"2026-07-22T23:40:00Z","title":"Simultaneous mission spawns attach the same sessionId to both durable Agent records","status":"open","severity":"medium","body":"Two spawns racing the registry both claim the same session.","refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-22T23:40:00Z"}
{"id":"issue_dm-to-unregistered-chief-shows-failed","kind":"issue","ts":"2026-07-22T23:42:00Z","title":"DM to an unregistered terminal chief session fails 404 and renders as failed in the Messages UI","status":"open","severity":"medium","body":"No pre-registration fallback; the failure surfaces raw in the UI.","refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-22T23:42:00Z"}
{"id":"issue_external-envelopes-lack-durable-ids","kind":"issue","ts":"2026-07-22T23:44:00Z","title":"Envelope durable-id stamping is roster-based — external parties never get senderAgentId/recipientAgentId","status":"open","severity":"medium","body":"Non-PTY parties are invisible to the durable-id trace.","refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-22T23:44:00Z"}
{"id":"issue_pull-mailboxes-are-reader-open","kind":"issue","ts":"2026-07-22T23:46:00Z","title":"Pull mailboxes are reader-open — any session can poll any mailbox","status":"open","severity":"medium","body":"Uniqueness is not enforceable reader-side.","refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-22T23:46:00Z"}
{"id":"issue_mailbox-shadows-future-pty","kind":"issue","ts":"2026-07-22T23:48:00Z","title":"Mailbox-first routing permanently shadows future same-name PTYs","status":"open","severity":"low","body":"A mailbox claimed today silently outranks tomorrow's live PTY of the same name.","refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-22T23:48:00Z"}
{"id":"issue_external-sessions-invisible-in-roster-ui","kind":"issue","ts":"2026-07-22T23:50:00Z","title":"Externally-registered sessions are invisible in the Agents roster UI and unreachable by nvk-agent status","status":"open","severity":"low","body":"Registration made them message-visible, not roster-visible.","refs":[{"kind":"mission","value":"mission_external-session-visibility"}],"updated":"2026-07-22T23:50:00Z"}
```

### threads.jsonl

```jsonl
{"id":"thread_external-session-visibility","kind":"thread","ts":"2026-07-22T22:00:00Z","roomId":"mission_external-session-visibility","refs":[{"kind":"mission","value":"mission_external-session-visibility"},{"kind":"agent","value":"agent_7698bef8-6493-4672-a648-ce3fba573d5a"}]}
```

### messages.jsonl

```jsonl
{"messageId":"msg_vis_01","kind":"message","threadId":"thread_external-session-visibility","senderId":"principal_chris","body":"The chief I spawned from the terminal is invisible in Mission Control. Fix it — and tell me why I can't see the other chief's live mission either.","createdAt":"2026-07-22T22:00:00Z","refs":[]}
{"messageId":"msg_vis_02","kind":"message","threadId":"thread_external-session-visibility","senderId":"agent_7698bef8-6493-4672-a648-ce3fba573d5a","body":"Registration verb landed. chief-kimi-2 is registered and shows as a DM lane; 2-way messages proven with screenshots.","createdAt":"2026-07-22T23:50:00Z","refs":[{"kind":"task","value":"task_vis-live-proof"}]}
{"messageId":"msg_vis_03","kind":"message","threadId":"thread_external-session-visibility","senderId":"agent_38f4706c-705a-40fe-a757-71c84b719d3d","body":"Diagnosis filed: six gaps, none blocking this mission. The other-chief question is the roster-visibility issue — registered sessions are message-visible but not roster-visible.","createdAt":"2026-07-23T00:00:00Z","refs":[{"kind":"issue","value":"issue_external-sessions-invisible-in-roster-ui"}]}
```

### agentRuns.jsonl

```jsonl
{"agentRunId":"run_vis-worker","kind":"agentRun","agentId":"agent_29b00827-e3ad-498f-bcd9-2567cfbd9e0b","taskId":"task_vis-live-proof","status":"succeeded","startedAt":"2026-07-22T23:30:00Z","endedAt":"2026-07-22T23:50:00Z"}
```
