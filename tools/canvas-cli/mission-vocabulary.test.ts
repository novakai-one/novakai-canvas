import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../src/domain/model';
import { architectureDocumentSchema } from '../../src/domain/schema';
import { parseDsl } from './dsl-parse.ts';
import { compile } from './compile.ts';
import { layoutScopes } from './layout.ts';
import { printScope } from './dsl-print.ts';

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

function emptyDoc(): ArchitectureDocument {
  return {
    schemaVersion: 1, id: 'doc', name: 'Doc', revision: 1,
    nodes: {}, interfaces: {}, types: {}, wires: {},
  };
}

function build() {
  const { scopes, errors } = parseDsl(DSL);
  expect(errors).toEqual([]);
  const result = compile(emptyDoc(), scopes);
  expect(result.errors).toEqual([]);
  return layoutScopes(result.doc, result.touchedScopeIds);
}

describe('mission vocabulary', () => {
  it('parses mentions and missing wire kinds', () => {
    const doc = build();
    const kinds = Object.values(doc.wires).map((wire) => wire.kind).sort();
    expect(kinds).toEqual(['mentions', 'missing']);
  });

  it('compiles tree rows with identity, hierarchy, badges, and bucket labels', () => {
    const doc = build();
    const tree = Object.values(doc.nodes).find((node) => node.kind === 'tree');
    expect(tree?.rows).toEqual([
      { id: 'proj_command', kind: 'project', status: 'active', badges: [] },
      { id: 'mission_m1', kind: 'mission', status: 'done', parentRowId: 'proj_command', badges: ['outcome', 'team'] },
      { id: 'task_t1', kind: 'task', status: 'in-progress', parentRowId: 'mission_m1', badges: [] },
      { id: 'orphan-tasks', kind: 'bucket', badges: [], label: '(no mission) 15 tasks' },
    ]);
  });

  it('validates against the document schema', () => {
    expect(() => architectureDocumentSchema.parse(build())).not.toThrow();
  });

  it('round-trips rows and new kinds through print → parse → compile', () => {
    const doc = build();
    const printed = printScope(doc, 'mission-state');
    const { scopes, errors } = parseDsl(printed);
    expect(errors).toEqual([]);
    const reapplied = compile(doc, scopes);
    expect(reapplied.errors).toEqual([]);
    const strip = (input: ArchitectureDocument) => ({
      nodes: Object.fromEntries(Object.entries(input.nodes).map(([id, node]) => {
        const { position: _position, size: _size, ...rest } = node;
        return [id, rest];
      })),
      wires: input.wires,
    });
    expect(strip(reapplied.doc)).toEqual(strip(doc));
  });

  it('rejects rows outside tree nodes and unknown row kinds', () => {
    const bad = parseDsl('scope "S"\n  module "m"\n    row a mission\n  tree "t"\n    row b widget\n');
    expect(bad.errors.map((error) => error.message)).toEqual([
      'row outside a tree node',
      'unknown row kind "widget"',
    ]);
  });
});
