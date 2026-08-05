import { describe, expect, it } from 'vitest';
import type { DiagramRecord } from '../../src/canvas.ts';
import { diagramRecordSchema } from '../../src/domain/record-schema.ts';
import { parseDsl } from './dsl-parse.ts';
import { buildRecord } from './dsl-fixture.ts';
import { printRecord } from './dsl-print.ts';

const DSL = `
scope "Mission State"
  module "mission store"
  runtime "Manager Kimi"
  tree "Store hierarchy"
    row proj_command project active
    row mission_m1 mission done parent=proj_command badges=outcome,team
    row task_t1 task in-progress parent=mission_m1
    row orphan-tasks bucket label "(no mission) 15 tasks"
  wire "mission store" -> "Manager Kimi" : owner name match [mentions]
  wire "Manager Kimi" -> "mission store" : no link exists [missing]
`;

function build(): DiagramRecord {
  return buildRecord(DSL);
}

describe('mission vocabulary', () => {
  it('parses mentions and missing wire kinds', () => {
    const record = build();
    const kinds = Object.values(record.wires).map((wire) => wire.kind).sort();
    expect(kinds).toEqual(['mentions', 'missing']);
  });

  it('compiles tree rows with identity, hierarchy, badges, and bucket labels', () => {
    const record = build();
    const tree = Object.values(record.nodes).find((node) => node.kind === 'tree');
    expect(tree?.rows).toEqual([
      { id: 'proj_command', kind: 'project', status: 'active', badges: [] },
      { id: 'mission_m1', kind: 'mission', status: 'done', parentRowId: 'proj_command', badges: ['outcome', 'team'] },
      { id: 'task_t1', kind: 'task', status: 'in-progress', parentRowId: 'mission_m1', badges: [] },
      { id: 'orphan-tasks', kind: 'bucket', badges: [], label: '(no mission) 15 tasks' },
    ]);
  });

  it('validates against the record schema', () => {
    expect(() => diagramRecordSchema.parse(build())).not.toThrow();
  });

  it('round-trips rows and new kinds through print → parse → compile', () => {
    const record = build();
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    const strip = (input: DiagramRecord) => ({ nodes: input.nodes, wires: input.wires });
    expect(strip(reapplied)).toEqual(strip(record));
  });

  it('rejects rows outside tree nodes and unknown row kinds', () => {
    const bad = parseDsl('scope "S"\n  module "m"\n    row a mission\n  tree "t"\n    row b widget\n');
    expect(bad.errors.map((error) => error.message)).toEqual([
      'row outside a tree node',
      'unknown row kind "widget"',
    ]);
  });
});
