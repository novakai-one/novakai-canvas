import { describe, expect, it } from 'vitest';
import { DEMO, dataDir, readRecord, readIndex, runCli, existsSync, readFile, join } from './cli-fixture.ts';

describe('canvas CLI', () => {
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

});
