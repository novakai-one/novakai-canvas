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
        const { position, size, ...rest } = node;
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
