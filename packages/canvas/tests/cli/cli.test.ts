import { describe, expect, it } from 'vitest';
import { DEMO, dataDir, readRecord, readIndex, placementsOf, runCli, existsSync, join } from './cli-fixture.ts';

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

  it('applies module definitions inside an arranged zone', async () => {
    const result = await runCli(['apply', '--file', dataDir], `
scope "Arranged definitions"
  zone "Flow" layout=stack gap=16 align=stretch
    module "Send service"
      send(Message) -> Receipt
      type Message { id, body }
  end
`);

    expect(result.code, result.stderr).toBe(0);
    const record = await readRecord('arranged-definitions');
    const module = Object.values(record.nodes).find((node) => node.label === 'Send service');
    expect(module).toBeDefined();
    expect(module!.interfaceIds).toHaveLength(1);
    expect(module!.typeIds).toHaveLength(1);
    expect(record.interfaces[module!.interfaceIds[0]]?.name).toBe('send');
    expect(record.types[module!.typeIds[0]]?.name).toBe('Message');
  });

});
