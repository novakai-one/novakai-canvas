import { beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { DiagramRecord, LibraryIndex } from '../../src/canvas.ts';

const CLI = resolve(import.meta.dirname, 'cli.ts');
const REAL_DATA = resolve(import.meta.dirname, '../../public/data');

interface RunResult { code: number; stdout: string; stderr: string }

function runCli(args: string[], input?: string): Promise<RunResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', rejectPromise);
    child.on('close', (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

const DEMO = `
scope "CLI Demo"
  note "Authored by the integration test."
  module "Demo broker" "Hands out demo sessions"
    acquire(AgentId) -> DemoHandle
    type DemoHandle { id, endpoint }
  module "Demo client"
  timeline "Demo history"
    step "turn 1"
  wire "Demo client" -> "Demo broker" : acquire(AgentId) -> DemoHandle [queries]
`;

let dataDir: string;

async function readRecord(id: string): Promise<DiagramRecord> {
  return JSON.parse(await readFile(join(dataDir, 'diagrams', `${id}.json`), 'utf8')) as DiagramRecord;
}

async function readIndex(): Promise<LibraryIndex> {
  return JSON.parse(await readFile(join(dataDir, 'library.json'), 'utf8')) as LibraryIndex;
}

function placementsOf(record: DiagramRecord) {
  return record.layouts[record.views[record.activeViewId].layoutId].placements;
}

async function dataHashes(): Promise<Record<string, string>> {
  const files = [
    'library.json',
    'canvas-preferences.json',
    ...(await readdir(join(dataDir, 'diagrams'))).sort().map((name) => `diagrams/${name}`),
  ];
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file,
    createHash('sha256').update(await readFile(join(dataDir, file))).digest('hex'),
  ])));
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'canvas-cli-'));
  await cp(join(REAL_DATA, 'library.json'), join(dataDir, 'library.json'));
  await cp(join(REAL_DATA, 'canvas-preferences.json'), join(dataDir, 'canvas-preferences.json'));
  await cp(join(REAL_DATA, 'diagrams'), join(dataDir, 'diagrams'), { recursive: true });
});

describe('canvas CLI', () => {
  it('includes registered timeline syntax in help', async () => {
    const { code, stdout } = await runCli(['help']);
    expect(code).toBe(0);
    expect(stdout).toContain('timeline');
    expect(stdout).toContain('step "label" [fork="session-id"]');
  });

  it('maps lists the three real scopes', async () => {
    const { code, stdout } = await runCli(['maps', '--file', dataDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('project-scope');
    expect(stdout).toContain('messaging-scope');
    expect(stdout).toContain('browser-scope');
  });

  it('apply from stdin writes one record as one change set with cli provenance', async () => {
    const { code, stdout } = await runCli([
      'apply', '--file', dataDir, '--operation-id', 'dsl-import-1',
    ], DEMO);
    expect(code, stdout).toBe(0);
    expect(stdout).toContain('applied: CLI Demo');

    expect(existsSync(join(dataDir, 'diagrams', 'cli-demo.json'))).toBe(true);
    const record = await readRecord('cli-demo');
    expect(record.schemaVersion).toBe(3);
    expect(record.name).toBe('CLI Demo');
    expect(record.nodes['cli-demo'].kind).toBe('group');
    expect(record.nodes['cli-demo--demo-broker'].parentId).toBe('cli-demo');
    // One operation, so one change set — not one per command.
    expect(Object.keys(record.appliedOperations)).toEqual(['dsl-import-1']);
    expect(record.appliedOperations['dsl-import-1']).toMatchObject({
      actor: { id: 'canvas-cli', kind: 'system' },
      provenance: { source: 'cli' },
    });
    // The index is a projection over the records and catches up on every apply.
    expect((await readIndex()).entries['cli-demo']).toMatchObject({ name: 'CLI Demo', status: 'active' });

    // Replaying the same DSL under the same operation id must not advance the revision.
    const replay = await runCli(['apply', '--file', dataDir, '--operation-id', 'dsl-import-1'], DEMO);
    expect(replay.code, replay.stderr).toBe(0);
    expect((await readRecord('cli-demo')).revision).toBe(record.revision);

    const changed = DEMO.replace('step "turn 1"', 'step "turn 2" fork="session-demo"');
    const changedApply = await runCli(['apply', '--file', dataDir], changed);
    expect(changedApply.code, changedApply.stderr).toBe(0);
    expect((await readRecord('cli-demo')).nodes['cli-demo--demo-history'].steps).toEqual([
      { id: 'turn-2', label: 'turn 2', fork: 'session-demo' },
    ]);
  });

  it('read prints the applied scope back as DSL', async () => {
    await runCli(['apply', '--file', dataDir], DEMO);
    const { code, stdout } = await runCli(['read', 'cli-demo', '--file', dataDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('acquire(AgentId) -> DemoHandle');
    expect(stdout).toContain('wire "Demo client" -> "Demo broker" : acquire(AgentId) -> DemoHandle [queries]');
  });

  it('apply round-trips a real map: read, apply, read again is byte-identical', async () => {
    const first = await runCli(['read', 'project-scope', '--file', dataDir]);
    expect(first.code).toBe(0);
    const applied = await runCli(['apply', '--file', dataDir], first.stdout);
    expect(applied.code, applied.stderr).toBe(0);

    const second = await runCli(['read', 'project-scope', '--file', dataDir]);
    const reapplied = await runCli(['apply', '--file', dataDir], second.stdout);
    expect(reapplied.code, reapplied.stderr).toBe(0);
    expect(reapplied.stdout).toContain('unchanged: Novakai IDE');
    const third = await runCli(['read', 'project-scope', '--file', dataDir]);
    expect(third.stdout).toBe(second.stdout);
  });

  it('a re-applied scope preserves every node id and placement when nothing changed', async () => {
    await runCli(['apply', '--file', dataDir], DEMO);
    const before = await readRecord('cli-demo');

    const { code, stderr, stdout } = await runCli(['apply', '--file', dataDir], DEMO);
    expect(code, stderr).toBe(0);
    expect(stdout).toContain('unchanged');
    const after = await readRecord('cli-demo');

    expect(Object.keys(after.nodes).sort()).toEqual(Object.keys(before.nodes).sort());
    expect(placementsOf(after)).toEqual(placementsOf(before));
    expect(after.revision).toBe(before.revision);
  });

  it('a scope that grows keeps the ids of the nodes it already had', async () => {
    await runCli(['apply', '--file', dataDir], DEMO);
    const before = await readRecord('cli-demo');

    const grown = `${DEMO}  module "Demo audit"\n`;
    const { code, stderr } = await runCli(['apply', '--file', dataDir], grown);
    expect(code, stderr).toBe(0);
    const after = await readRecord('cli-demo');

    expect(after.nodes['cli-demo--demo-audit']).toBeDefined();
    for (const id of Object.keys(before.nodes)) {
      expect(after.nodes[id], `node ${id} kept its id`).toBeDefined();
      expect(after.nodes[id].label).toBe(before.nodes[id].label);
    }
    // Geometry is content-driven, so adding a node re-ranks the map: ids survive, coordinates
    // are recomputed. That is the same bargain `./canvas apply` has always made.
  });

  it('keeps the one real cross-diagram relationship across a re-apply', async () => {
    const before = await readIndex();
    expect(before.links['session-agents']).toBeDefined();

    const read = await runCli(['read', 'project-scope', '--file', dataDir]);
    expect(read.stdout).toContain('wire "Agent session" -> "Agent PTYs" : is a');
    const applied = await runCli(['apply', '--file', dataDir], read.stdout);
    expect(applied.code, applied.stderr).toBe(0);

    const after = await readIndex();
    // Same link, same id, same ends — not a second link beside the first.
    expect(Object.keys(after.links)).toEqual(['session-agents']);
    expect(after.links['session-agents']).toEqual(before.links['session-agents']);
    // And it lives in neither record, because a wire belongs to exactly one diagram.
    const record = await readRecord('project-scope');
    expect(Object.values(record.wires).some((wire) => wire.target.nodeId === 'msg-agents')).toBe(false);
  });

  it('describes the record command vocabulary for an unfamiliar agent', async () => {
    const { code, stdout } = await runCli(['describe']);
    expect(code).toBe(0);
    const description = JSON.parse(stdout) as Record<string, unknown>;
    expect(description).toMatchObject({
      schemaVersion: 3,
      unit: 'diagram-record',
      nodeAliases: { group: 'scope' },
    });
    expect(description.commandKinds).toContain('node.add');
    const dsl = description.dsl as {
      components: Array<Record<string, unknown>>;
      wire: Record<string, unknown>;
    };
    expect(dsl.components.map((component) => component.kind)).toEqual([
      'group', 'module', 'object', 'runtime', 'resource', 'comment', 'tree', 'timeline',
      'metric', 'icon-card', 'callout-stack', 'block', 'ooux-object', 'entity',
    ]);
    expect(dsl.components.find((component) => component.kind === 'group')).toMatchObject({
      keyword: 'zone',
      arrangement: { layout: { values: ['stack', 'row', 'grid'] } },
    });
    expect(dsl.components.find((component) => component.kind === 'icon-card')).toMatchObject({
      keyword: 'icon-card',
      declaration: {
        syntax: 'icon-card "title" icon=check|clock|people|shield|target|trend description="text"',
      },
      appearance: [],
    });
    const block = dsl.components.find((component) => component.kind === 'block');
    expect(block).toMatchObject({ keyword: 'block' });
    expect(block?.appearance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'icon', values: ['check', 'clock', 'people', 'shield', 'target', 'trend'],
      }),
      expect.objectContaining({ key: 'vertical-align', values: ['top', 'center', 'bottom'] }),
    ]));
    expect(dsl.components.find((component) => component.kind === 'entity')).toMatchObject({
      keyword: 'entity',
      children: [{
        keyword: 'field',
        syntax: 'field "name" id=stable-id type=value-type [keys=pk,fk,uk]',
      }],
      appearance: [{
        key: 'palette', values: ['neutral', 'blue', 'violet', 'sage'],
        omitted: 'component default',
      }],
    });
    expect(dsl.wire).toMatchObject({
      endpoints: ['label', '@ref', '#node-id'],
      cardinality: {
        source: { key: 'source-cardinality', values: ['one', 'zero-or-one', 'one-or-many', 'zero-or-many'] },
        target: { key: 'target-cardinality', values: ['one', 'zero-or-one', 'one-or-many', 'zero-or-many'] },
      },
    });
    expect(dsl.wire.appearance).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'shape', values: ['elbow', 'straight', 'curved', 'stepped'] }),
    ]));
  });

  it('check validates and lays out file or stdin DSL without changing stored data', async () => {
    const candidate = join(dataDir, 'candidate.canvas');
    await writeFile(candidate, DEMO, 'utf8');
    const before = await dataHashes();

    const valid = await runCli(['check', candidate, '--file', dataDir]);
    expect(valid.code, valid.stderr).toBe(0);
    expect(JSON.parse(valid.stdout)).toEqual({
      status: 'valid',
      diagrams: [{ id: 'cli-demo', name: 'CLI Demo', nodes: 4, wires: 1 }],
      warnings: [],
    });

    const invalid = await runCli(['check', '--file', dataDir], 'scope Demo\n  banana "Split"\n');
    expect(invalid.code, invalid.stderr).toBe(1);
    expect(JSON.parse(invalid.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 2,
        reason: 'unknown statement "banana"',
        correction: expect.stringContaining('valid statements:'),
      }],
    });
    expect(await dataHashes()).toEqual(before);
  });

  it('discovers, checks, applies, and revisions presentation without a check write', async () => {
    const dsl = `
scope "Presentation CLI" layout=stack gap=8
  block "Signal" size=20 weight=600 align=center text=green border-color=green border=1 radius=8 padding=12
    line "Ready"
  module "Worker" badge=hide
`;
    const described = await runCli(['describe']);
    expect(described.code, described.stderr).toBe(0);
    expect(described.stdout).toContain('"grid"');
    expect(described.stdout).toContain('"columns"');
    expect(described.stdout).toContain('"border-color"');
    expect(described.stdout).toContain('"badge"');

    const beforeCheck = await dataHashes();
    const checked = await runCli(['check', '--file', dataDir], dsl);
    expect(checked.code, checked.stderr).toBe(0);
    expect(await dataHashes()).toEqual(beforeCheck);

    const applied = await runCli([
      'apply', '--file', dataDir, '--operation-id', 'presentation-green',
    ], dsl);
    expect(applied.code, applied.stderr).toBe(0);
    const green = await readRecord('presentation-cli');
    const layoutId = green.views[green.activeViewId].layoutId;
    expect(green.layouts[layoutId].appearanceByNodeId).toMatchObject({
      'presentation-cli--block-signal': {
        size: 20, weight: 600, align: 'center', text: 'green',
        borderColor: 'green', border: 1, radius: 8, padding: 12,
      },
      'presentation-cli--worker': { badge: 'hide' },
    });
    expect(green.layouts[layoutId].arrangementByContainerId['presentation-cli'])
      .toMatchObject({ layout: 'stack', gap: 8, align: 'stretch' });

    const blueApply = await runCli([
      'apply', '--file', dataDir, '--operation-id', 'presentation-blue',
    ], dsl.replace('text=green', 'text=blue'));
    expect(blueApply.code, blueApply.stderr).toBe(0);
    const blue = await readRecord('presentation-cli');
    expect(blue.revision).toBe(green.revision + 1);
    expect(blue.nodes).toEqual(green.nodes);
    expect(blue.layouts[layoutId].appearanceByNodeId['presentation-cli--block-signal'].text)
      .toBe('blue');
  });

  it('check reports missing and unknown icon-card content with usable corrections', async () => {
    const missing = await runCli(['check', '--file', dataDir], `
scope "Icon Diagnostics"
  icon-card "Automated checks" icon=check
`);
    expect(missing.code, missing.stderr).toBe(1);
    expect(JSON.parse(missing.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 3,
        reason: 'icon-card needs description="text"',
        correction: 'icon-card "title" icon=check|clock|people|shield|target|trend description="text"',
      }],
    });

    const unknown = await runCli(['check', '--file', dataDir], `
scope "Icon Diagnostics"
  icon-card "Automated checks" icon=rocket description="Every change is verified."
`);
    expect(unknown.code, unknown.stderr).toBe(1);
    expect(JSON.parse(unknown.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 3,
        reason: 'unknown icon "rocket"; use one of: check|clock|people|shield|target|trend',
        correction: 'icon-card "title" icon=check|clock|people|shield|target|trend description="text"',
      }],
    });
  });

  it('check reports exact callout lines and corrections for every invalid item shape', async () => {
    const syntax = 'callout "text" id=<stable-id> kind=info|warning|decision|success';
    const cases = [
      {
        child: 'callout id=evidence kind=info',
        reason: 'callout needs text',
        line: 4,
      },
      {
        child: 'callout "Evidence is complete" kind=info',
        reason: 'callout needs id=<stable-id>',
        line: 4,
      },
      {
        child: 'callout "Evidence is complete" id=evidence',
        reason: 'callout needs kind=info|warning|decision|success',
        line: 4,
      },
      {
        child: 'callout "Evidence is complete" id=evidence kind=urgent',
        reason: 'unknown callout kind "urgent"; use one of: info|warning|decision|success',
        line: 4,
      },
    ];
    for (const invalid of cases) {
      const result = await runCli(['check', '--file', dataDir], `
scope "Callout Diagnostics"
  callout-stack "Release decision"
    ${invalid.child}
`);
      expect(result.code, result.stderr).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual({
        status: 'invalid',
        errors: [{ line: invalid.line, reason: invalid.reason, correction: syntax }],
      });
    }

    const duplicate = await runCli(['check', '--file', dataDir], `
scope "Callout Diagnostics"
  callout-stack "Release decision"
    callout "First" id=evidence kind=info
    callout "Second" id=evidence kind=warning
`);
    expect(duplicate.code, duplicate.stderr).toBe(1);
    expect(JSON.parse(duplicate.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 5,
        reason: 'duplicate callout id "evidence"',
        correction: syntax,
      }],
    });
  });

  it('applies an idempotent agent batch once and persists its authorship', async () => {
    await runCli(['apply', '--file', dataDir], DEMO);
    const before = await readRecord('cli-demo');
    const changeSet = {
      operationId: 'cli-agent-op-1',
      expectedRevision: before.revision,
      timestamp: '2026-08-05T12:00:00.000Z',
      commands: [{
        kind: 'node.add',
        node: {
          id: 'cli-added-node', kind: 'module', label: 'CLI added node',
          parentId: 'cli-demo', interfaceIds: [], typeIds: [],
        },
        placement: { position: { x: 20, y: 40 }, size: { width: 180, height: 90 } },
      }],
    };
    const first = await runCli(['batch', 'cli-demo', '--file', dataDir], JSON.stringify(changeSet));
    expect(first.code, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({ status: 'applied', revision: before.revision + 1 });

    const duplicate = await runCli(['batch', 'cli-demo', '--file', dataDir], JSON.stringify(changeSet));
    expect(duplicate.code).toBe(0);
    expect(JSON.parse(duplicate.stdout)).toMatchObject({ status: 'duplicate', originalRevision: before.revision + 1 });

    const after = await readRecord('cli-demo');
    expect(after.nodes['cli-added-node']).toBeDefined();
    expect(after.appliedOperations['cli-agent-op-1']).toMatchObject({
      actor: { id: 'canvas-cli', kind: 'system' },
      provenance: { source: 'cli' },
    });
  });

  it('rejects an unknown batch command kind rather than silently ignoring it', async () => {
    const { code, stderr } = await runCli(['batch', 'project-scope', '--file', dataDir], JSON.stringify({
      operationId: 'bad-1', commands: [{ kind: 'node.teleport', id: 'session' }],
    }));
    expect(code).toBe(1);
    expect(stderr).toContain('unknown command kind "node.teleport"');
  });

  it('rejects broken DSL with every error and leaves the records untouched', async () => {
    const before = await readFile(join(dataDir, 'diagrams', 'project-scope.json'), 'utf8');
    const broken = 'scope Demo\n  wire A -> B\n  banana "Split"\n';
    const { code, stderr } = await runCli(['apply', '--file', dataDir], broken);
    expect(code).toBe(1);
    expect(stderr).toContain('needs a contract');
    expect(stderr).toContain('banana');
    expect(existsSync(join(dataDir, 'diagrams', 'demo.json'))).toBe(false);
    expect(await readFile(join(dataDir, 'diagrams', 'project-scope.json'), 'utf8')).toBe(before);
  });

  it('rm removes a whole map, its record file, and its index entry', async () => {
    await runCli(['apply', '--file', dataDir], DEMO);
    const { code, stdout } = await runCli(['rm', 'cli-demo', '--file', dataDir]);
    expect(code, stdout).toBe(0);
    expect(existsSync(join(dataDir, 'diagrams', 'cli-demo.json'))).toBe(false);
    expect((await readIndex()).entries['cli-demo']).toBeUndefined();
  });

  it('rm refuses a map another map links to', async () => {
    const { code, stderr } = await runCli(['rm', 'messaging-scope', '--file', dataDir]);
    expect(code).toBe(1);
    expect(stderr).toContain('session-agents');
    expect(existsSync(join(dataDir, 'diagrams', 'messaging-scope.json'))).toBe(true);
  });

  it('rm removes a single node and its wires', async () => {
    await runCli(['apply', '--file', dataDir], DEMO);
    const { code, stdout } = await runCli(['rm', 'cli-demo', 'Demo client', '--file', dataDir]);
    expect(code, stdout).toBe(0);
    const after = await readRecord('cli-demo');
    expect(after.nodes['cli-demo--demo-client']).toBeUndefined();
    expect(after.nodes['cli-demo--demo-broker']).toBeDefined();
    expect(Object.values(after.wires).some((wire) => wire.source.nodeId === 'cli-demo--demo-client')).toBe(false);
  });

  it('rm cascades a zone: descendant closure, incident wires, referential integrity', async () => {
    const zoned = `
scope "Zoned Demo"
  zone "Stores"
    module "missions.jsonl"
      type Mission { id, title }
    zone "Archive"
      module "old store"
    end
  end
  module "Room"
  wire "missions.jsonl" -> "Room" : read() -> Rows [queries]
  wire "old store" -> "Room" : read() -> Rows [queries]
  wire "Stores" -> "Room" : groups [owns]
`;
    await runCli(['apply', '--file', dataDir], zoned);
    const { code, stdout } = await runCli(['rm', 'zoned-demo', 'Stores', '--file', dataDir]);
    expect(code, stdout).toBe(0);
    const after = await readRecord('zoned-demo');
    // whole closure gone: zone, nested zone, both leaf modules
    expect(after.nodes['zoned-demo--stores']).toBeUndefined();
    expect(after.nodes['zoned-demo--stores--archive']).toBeUndefined();
    expect(after.nodes['zoned-demo--stores--missions-jsonl']).toBeUndefined();
    expect(after.nodes['zoned-demo--stores--archive--old-store']).toBeUndefined();
    // sibling untouched
    expect(after.nodes['zoned-demo--room']).toBeDefined();
    // referential integrity: nothing points at a removed node
    const nodeIds = new Set(Object.keys(after.nodes));
    for (const wire of Object.values(after.wires)) {
      expect(nodeIds.has(wire.source.nodeId)).toBe(true);
      expect(nodeIds.has(wire.target.nodeId)).toBe(true);
    }
    for (const method of Object.values(after.interfaces)) {
      expect(nodeIds.has(method.ownerId)).toBe(true);
    }
    for (const node of Object.values(after.nodes)) {
      expect(node.parentId === undefined || nodeIds.has(node.parentId)).toBe(true);
    }
    // Types deliberately OUTLIVE the node that referenced them. `node.remove` in
    // `canvas-workspace.ts` leaves them alone on purpose, because a type carries no owner and
    // real diagrams share one across several nodes. The old document CLI deleted them; the
    // record capability does not, and no node is left pointing at a type that is gone.
    expect(after.types['zoned-demo--stores--missions-jsonl--type-mission']).toBeDefined();
    for (const node of Object.values(after.nodes)) {
      for (const typeId of node.typeIds) expect(after.types[typeId]).toBeDefined();
    }
  });

  it('snapshot renders a map to SVG', async () => {
    const out = join(dataDir, 'project-scope.svg');
    const { code, stdout } = await runCli(['snapshot', 'project-scope', '-o', out, '--file', dataDir]);
    expect(code, stdout).toBe(0);
    const svg = await readFile(out, 'utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Novakai IDE');
  });

  it('help teaches the grammar and every verb', async () => {
    const { code, stdout } = await runCli(['help']);
    expect(code).toBe(0);
    for (const verb of ['maps', 'read', 'describe', 'batch', 'apply', 'check', 'rm', 'snapshot']) expect(stdout).toContain(verb);
    expect(stdout).toContain('scope "');
    expect(stdout).toContain('wire');
    expect(stdout).toContain('->');
  });

  it('no args prints help too', async () => {
    const { stdout } = await runCli([]);
    expect(stdout).toContain('scope "');
  });
});
