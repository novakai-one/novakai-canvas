import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../src/domain/model';
import { parseDsl } from './dsl-parse.ts';
import { compile } from './compile.ts';
import { layoutScopes } from './layout.ts';
import { listMaps, printOutline, printScope } from './dsl-print.ts';

const DSL = `
scope "Browser Sessions" "Isolated per-agent browsing"
  note "One session per instance."
  module "browse CLI" "Entry point"
    goto(Url) -> ActionResult
  module "Session broker"
    acquire(AgentId) -> SessionHandle
    type Lease { agentId, ttl }
  wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]
  wire "Session broker" -> "browse CLI" : ack(SessionHandle) -> void
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

describe('printScope', () => {
  it('prints contract on every wire and kind only when not the default', () => {
    const output = printScope(build(), 'browser-sessions');
    expect(output).toContain('wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]');
    expect(output).toContain('wire "Session broker" -> "browse CLI" : ack(SessionHandle) -> void');
    expect(output).not.toContain('[references]');
    expect(output).toContain('note "One session per instance."');
    expect(output).toContain('scope "Browser Sessions" "Isolated per-agent browsing"');
    expect(output).toContain('type Lease { agentId, ttl }');
  });

  it('round-trips: applying the printed outline reproduces the same structure', () => {
    const doc = build();
    const printed = printScope(doc, 'browser-sessions');
    const { scopes, errors } = parseDsl(printed);
    expect(errors).toEqual([]);
    const reapplied = compile(doc, scopes);
    expect(reapplied.errors).toEqual([]);
    expect(reapplied.warnings).toEqual([]);

    const strip = (input: ArchitectureDocument) => ({
      nodes: Object.fromEntries(Object.entries(input.nodes).map(([id, node]) => {
        const { position: _position, size: _size, ...rest } = node;
        return [id, rest];
      })),
      interfaces: input.interfaces,
      types: input.types,
      wires: input.wires,
    });
    expect(strip(reapplied.doc)).toEqual(strip(doc));
  });
});

describe('printOutline / listMaps', () => {
  it('lists top-level scopes with node and wire counts', () => {
    const doc = build();
    expect(listMaps(doc)).toEqual([
      { id: 'browser-sessions', label: 'Browser Sessions', nodes: 3, wires: 2 },
    ]);
    expect(printOutline(doc)).toContain('scope "Browser Sessions"');
  });
});

describe('printScope with nested zones', () => {
  const ZONED_DSL = `
scope "Mission Map"
  zone "Stores"
    module "missions.jsonl"
      type Mission { id, title }
    zone "Archive"
      module "old store"
    end
  end
  zone "Standalone — no mission"
    module "orphan task"
  end
  module "Mission Room"
  wire "missions.jsonl" -> "Mission Room" : read() -> Rows [queries]
  wire "Stores" -> "Archive" : keeps [owns]
`;

  function buildZoned() {
    const { scopes, errors } = parseDsl(ZONED_DSL);
    expect(errors).toEqual([]);
    const result = compile(emptyDoc(), scopes);
    expect(result.errors).toEqual([]);
    return layoutScopes(result.doc, result.touchedScopeIds);
  }

  it('prints nested scopes as zone/end blocks with wires at scope level', () => {
    const output = printScope(buildZoned(), 'mission-map');
    expect(output).toContain('zone "Stores"');
    expect(output).toContain('zone "Archive"');
    expect(output).toContain('zone "Standalone — no mission"');
    expect(output.match(/^  end$/gm)).toHaveLength(2);
    expect(output).toContain('wire "Stores" -> "Archive" : keeps [owns]');
    expect(output).not.toContain('scope "Archive"');
  });

  it('round-trips nested zones: re-applying the print reproduces the structure', () => {
    const doc = buildZoned();
    const printed = printScope(doc, 'mission-map');
    const { scopes, errors } = parseDsl(printed);
    expect(errors).toEqual([]);
    const reapplied = compile(doc, scopes);
    expect(reapplied.errors).toEqual([]);
    expect(reapplied.warnings).toEqual([]);

    const strip = (input: ArchitectureDocument) => ({
      nodes: Object.fromEntries(Object.entries(input.nodes).map(([id, node]) => {
        const { position: _position, size: _size, ...rest } = node;
        return [id, rest];
      })),
      interfaces: input.interfaces,
      types: input.types,
      wires: input.wires,
    });
    expect(strip(reapplied.doc)).toEqual(strip(doc));
  });
});
