# Work Session Report UI Prototype

**Question:** Which embedded layout lets a visual thinker understand outcome,
changed modules, important workflow, proof, decisions, and next action in roughly
30 seconds?

Open the development-only route:

```text
http://localhost:5173/?prototype=work-session-report&variant=A
```

- `A` — Playback room: workflow selection drives the central stage and evidence path.
- `B` — Change-map first: module selection drives the dominant wire map and inspector.
- `C` — Evidence wall: proof and artifact selection drives receipt context, with compact map and workflow support.

All variants load and runtime-validate `/reports/accepted-report.json`, consume
only its frozen `PublishedReportProjection`, and expose no reporting mutation.
The floating switcher and left/right arrow keys update the shareable `variant`
query parameter; arrow keys are ignored while an editable control has focus.

## Verdict

Pending Chris's comparison. No variant is promoted and no selection is persisted.
Delete the losing variants once the design question is answered, then rewrite the
selected treatment as production code.
