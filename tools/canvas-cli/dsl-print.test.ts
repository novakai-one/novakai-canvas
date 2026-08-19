import { describe, expect, it } from 'vitest';
import type { CrossDiagramLink, DiagramRecord } from '../../src/canvas.ts';
import { componentFor } from '../../src/components/registry.ts';
import { buildRecord, buildRecords } from './dsl-fixture.ts';
import { listMaps, printLibrary, printRecord } from './dsl-print.ts';

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

/** Content is what a round trip has to preserve; ids and revisions are storage, not meaning. */
function content(record: DiagramRecord) {
  return {
    nodes: record.nodes,
    interfaces: record.interfaces,
    types: record.types,
    wires: record.wires,
  };
}

describe('printRecord', () => {
  it('prints contract on every wire and kind only when not the default', () => {
    const output = printRecord(buildRecord(DSL));
    expect(output).toContain('wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]');
    expect(output).toContain('wire "Session broker" -> "browse CLI" : ack(SessionHandle) -> void');
    expect(output).not.toContain('[references]');
    expect(output).toContain('note "One session per instance."');
    expect(output).toContain('scope "Browser Sessions" "Isolated per-agent browsing"');
    expect(output).toContain('type Lease { agentId, ttl }');
  });

  it('round-trips: re-applying the printed map reproduces the same record content', () => {
    const record = buildRecord(DSL);
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    expect(content(reapplied)).toEqual(content(record));
  });

  it('preserves node ids and placements for unchanged nodes across a re-apply', () => {
    const record = buildRecord(DSL);
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    expect(Object.keys(reapplied.nodes).sort()).toEqual(Object.keys(record.nodes).sort());
    expect(reapplied.layouts[reapplied.views[reapplied.activeViewId].layoutId].placements)
      .toEqual(record.layouts[record.views[record.activeViewId].layoutId].placements);
  });

  it('prints a cross-diagram link as an ordinary wire, so read stays lossless', () => {
    const { records } = buildRecords(`
scope "Novakai IDE"
  module Session

scope "Agent Messaging"
  module Agents
`);
    const link = {
      id: 'session-agents', kind: 'references', label: 'is a',
      source: { diagramId: 'novakai-ide', nodeId: 'novakai-ide--session' },
      target: { diagramId: 'agent-messaging', nodeId: 'agent-messaging--agents' },
    } as unknown as CrossDiagramLink;
    const context = {
      links: [link],
      labelOf: (diagramId: string, nodeId: string) => records[diagramId]?.nodes[nodeId]?.label,
    };
    expect(printRecord(records['novakai-ide'], context)).toContain('wire "Session" -> "Agents" : is a');
    // The link is outbound from one map only; the other must not print it a second time.
    expect(printRecord(records['agent-messaging'], context)).not.toContain('is a');
  });
});

describe('printLibrary / listMaps', () => {
  it('lists maps with node and wire counts', () => {
    const record = buildRecord(DSL);
    expect(listMaps([record])).toEqual([
      { id: 'browser-sessions', label: 'Browser Sessions', nodes: 3, wires: 2 },
    ]);
    expect(printLibrary([record])).toContain('scope "Browser Sessions"');
  });

  it('counts an outbound cross-diagram link as a wire of its source map', () => {
    const record = buildRecord('scope "Solo"\n  module A\n');
    const link = {
      id: 'l1', kind: 'references', label: 'is a',
      source: { diagramId: 'solo', nodeId: 'solo--a' },
      target: { diagramId: 'other', nodeId: 'other--b' },
    } as unknown as CrossDiagramLink;
    expect(listMaps([record], [link])[0].wires).toBe(1);
  });
});

describe('every node-declaring keyword round-trips', () => {
  // One scope using every statement a component declares: the four card keywords, tree with a
  // row, note, and a zone holding a node. Guards the parse → print → parse path while the
  // vocabulary moves from hardcoded lists to the component registry.
  const EVERY_KEYWORD_DSL = `
scope "Every Keyword" "one of each"
  module "A module" "with a description"
    call(In) -> Out
    type Shape { a, b }
  object "An object"
  runtime "A runtime"
  resource "a-resource.json"
  note "A free-text note."
  tree "A tree"
    row proj1 project active label "Project One"
    row task1 task in-progress parent=proj1 badges=team,outcome
  timeline "A timeline"
    step "turn 1"
    step "turn 3" fork="session-xyz789"
  zone "A zone" "holding one node"
    module "zoned module"
  end
  wire "A module" -> "zoned module" : call(In) -> Out [queries]
`;

  it('parses, prints, and re-parses to the same record content', () => {
    const record = buildRecord(EVERY_KEYWORD_DSL);
    expect(Object.values(record.nodes).map((node) => node.kind).sort()).toEqual(
      ['comment', 'group', 'group', 'module', 'module', 'object', 'resource', 'runtime', 'timeline', 'tree'],
    );
    const printed = printRecord(record);
    for (const node of Object.values(record.nodes).filter((candidate) => candidate.parentId)) {
      expect(printed).toContain(componentFor(node.kind).declaration.print(node));
    }
    for (const statement of ['module "A module"', 'object "An object"', 'runtime "A runtime"',
      'resource "a-resource.json"', 'note "A free-text note."', 'tree "A tree"',
      'zone "A zone"', 'row proj1 project active label "Project One"',
      'row task1 task in-progress parent=proj1 badges=team,outcome',
      'timeline "A timeline"', 'step "turn 1"', 'step "turn 3" fork="session-xyz789"']) {
      expect(printed).toContain(statement);
    }
    const reapplied = buildRecord(printed, { [record.id]: record });
    expect(content(reapplied)).toEqual(content(record));
    expect(printRecord(reapplied)).toBe(printed);
  });
});

describe('printRecord with nested zones', () => {
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

  it('prints nested groups as zone/end blocks with wires at scope level', () => {
    const output = printRecord(buildRecord(ZONED_DSL));
    expect(output).toContain('zone "Stores"');
    expect(output).toContain('zone "Archive"');
    expect(output).toContain('zone "Standalone — no mission"');
    expect(output.match(/^  end$/gm)).toHaveLength(2);
    expect(output).toContain('wire "Stores" -> "Archive" : keeps [owns]');
    expect(output).not.toContain('scope "Archive"');
  });

  it('round-trips nested zones: re-applying the print reproduces the structure', () => {
    const record = buildRecord(ZONED_DSL);
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    expect(content(reapplied)).toEqual(content(record));
  });
});
