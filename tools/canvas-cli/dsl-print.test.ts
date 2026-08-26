import { describe, expect, it } from 'vitest';
import {
  exportDiagram, exportDiagrams, type CrossDiagramLink, type DiagramExportContext,
  type DiagramRecord,
} from '../../src/canvas.ts';
import { componentFor } from '../../src/components/registry.ts';
import { buildRecord, buildRecords } from './dsl-fixture.ts';
import { listMaps } from './cli-library.ts';

function printRecord(record: DiagramRecord, context?: DiagramExportContext): string {
  return exportDiagram(record, context ?? { records: { [record.id]: record }, links: [] }, 'dsl');
}

function printLibrary(records: readonly DiagramRecord[]): string {
  return exportDiagrams(
    records, { records: Object.fromEntries(records.map((record) => [record.id, record])), links: [] }, 'dsl',
  );
}

const DSL = `
scope "Browser Sessions" "Isolated per-agent browsing"
  note "One session per instance."
  module "browse CLI" "Entry point"
    goto(Url) -> ActionResult
  module "Session broker"
    acquire(AgentId) -> SessionHandle
    type Lease { agentId, ttl }
  wire "browse CLI" -> "Session broker" shape=curved : acquire(AgentId) -> SessionHandle [queries]
  wire "Session broker" -> "browse CLI" : ack(SessionHandle) -> void
`;

/** Content is what a round trip has to preserve; ids and revisions are storage, not meaning. */
function content(record: DiagramRecord) {
  return {
    nodes: record.nodes,
    interfaces: record.interfaces,
    types: record.types,
    wires: record.wires,
    flows: record.flows,
  };
}

describe('printRecord', () => {
  it('prints contract on every wire and kind only when not the default', () => {
    const output = printRecord(buildRecord(DSL));
    expect(output).toContain('wire "browse CLI" -> "Session broker" shape=curved : acquire(AgentId) -> SessionHandle [queries]');
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

  it('round-trips canonical flows without changing the basemap', () => {
    const record = buildRecord(`scope "Flow Round Trip"
  module A
  module B
  module C
  wire A -> B : first
  wire B -> C : second
  flow "Delivery"
    step 2 "flow-round-trip--wire-2"
    step 1 "flow-round-trip--wire-1"
  end`);
    const basemap = JSON.stringify([record.nodes, record.wires, record.layouts, record.views]);
    const printed = printRecord(record);
    expect(printed).toContain('step 1 "flow-round-trip--wire-1"\n    step 2 "flow-round-trip--wire-2"');
    const reapplied = buildRecord(printed, { [record.id]: record });
    expect(reapplied.flows).toEqual(record.flows);
    expect(JSON.stringify([reapplied.nodes, reapplied.wires, reapplied.layouts, reapplied.views])).toBe(basemap);
  });

  it('preserves node ids and placements for unchanged nodes across a re-apply', () => {
    const record = buildRecord(DSL);
    const layout = record.layouts[record.views[record.activeViewId].layoutId];
    layout.placements['browser-sessions--browse-cli'] = {
      ...layout.placements['browser-sessions--browse-cli'],
      position: { x: 640, y: 360 }, size: { width: 330, height: 180 },
      sizeMode: 'manual', pinned: true,
    };
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    expect(Object.keys(reapplied.nodes).sort()).toEqual(Object.keys(record.nodes).sort());
    expect(reapplied.layouts[reapplied.views[reapplied.activeViewId].layoutId].placements)
      .toEqual(record.layouts[record.views[record.activeViewId].layoutId].placements);
  });

  it('canonically round-trips multiline block appearance and container arrangements', () => {
    const record = buildRecord(`
scope "Styled Round Trip" layout=grid columns=2 gap=24
  zone "Left" layout=stack gap=8 align=center
    block "Tasks:" padding=12 radius=8 border=1 border-color=green background=surface text=green vertical-align=center align=center weight=600 size=20
      line "• Safety"
      line "• Code"
  end
  zone "Right"
    module "Prompt" badge=hide
  end
`);
    const printed = printRecord(record);
    expect(printed).toContain('scope "Styled Round Trip" layout=grid columns=2 gap=24');
    expect(printed).toContain('zone "Left" layout=stack gap=8 align=center');
    expect(printed).toContain('block "Tasks:" size=20 weight=600 align=center vertical-align=center text=green background=surface border-color=green border=1 radius=8 padding=12');
    expect(printed).toContain('line "• Safety"\n      line "• Code"');
    expect(printed).toContain('module "Prompt" badge=hide');

    const reapplied = buildRecord(printed, { [record.id]: record });
    const layoutOf = (candidate: DiagramRecord) =>
      candidate.layouts[candidate.views[candidate.activeViewId].layoutId];
    expect(layoutOf(reapplied).appearanceByNodeId).toEqual(layoutOf(record).appearanceByNodeId);
    expect(layoutOf(reapplied).arrangementByContainerId).toEqual(layoutOf(record).arrangementByContainerId);
    expect(reapplied.nodes['styled-round-trip--left--block-tasks'].lines)
      .toEqual(['• Safety', '• Code']);
    expect(printRecord(reapplied)).toBe(printed);
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
    const context = { links: [link], records };
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
  module "A module" "with a description" palette=sage
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
  metric "Success rate" value="92%" detail="12 of 13 runs" status=success
  icon-card "Automated checks" icon=check description="Every change is verified."
  callout-stack "Release decision"
    callout "Evidence is complete" id=evidence kind=info
    callout "Ship the release" id=decision kind=decision
  ooux-object "Organization" ref=organization palette=neutral
    attribute "org_name" id=org-name type=string role=core
    cta "inviteMember" id=invite-member role=admin
  entity "Provider session" ref=provider-session palette=violet
    field "id" id=id type=string keys=pk
    field "agentId" id=agent-id type=string keys=fk,uk
  zone "A zone" "holding one node"
    module "zoned module"
  end
  wire "A module" -> "zoned module" source-cardinality=one target-cardinality=zero-or-many : call(In) -> Out [queries]
`;

  it('parses, prints, and re-parses to the same record content', () => {
    const record = buildRecord(EVERY_KEYWORD_DSL);
    expect(Object.values(record.nodes).map((node) => node.kind).sort()).toEqual(
      ['callout-stack', 'comment', 'entity', 'group', 'group', 'icon-card', 'metric', 'module', 'module', 'object', 'ooux-object', 'resource', 'runtime', 'timeline', 'tree'],
    );
    const printed = printRecord(record);
    for (const node of Object.values(record.nodes).filter((candidate) => candidate.parentId)) {
      expect(printed).toContain(componentFor(node.kind).declaration.print(node));
    }
    for (const statement of ['module "A module" "with a description" palette=sage', 'object "An object"', 'runtime "A runtime"',
      'resource "a-resource.json"', 'note "A free-text note."', 'tree "A tree"',
      'zone "A zone"', 'row proj1 project active label "Project One"',
      'row task1 task in-progress parent=proj1 badges=team,outcome',
      'timeline "A timeline"', 'step "turn 1"', 'step "turn 3" fork="session-xyz789"',
      'metric "Success rate" value="92%" detail="12 of 13 runs" status=success',
      'icon-card "Automated checks" icon=check description="Every change is verified."',
      'callout-stack "Release decision"',
      'callout "Evidence is complete" id=evidence kind=info',
      'callout "Ship the release" id=decision kind=decision',
      'ooux-object "Organization" ref=organization palette=neutral',
      'attribute "org_name" id=org-name type=string role=core',
      'cta "inviteMember" id=invite-member role=admin',
      'entity "Provider session" ref=provider-session palette=violet',
      'field "id" id=id type=string keys=pk',
      'field "agentId" id=agent-id type=string keys=fk,uk',
      'source-cardinality=one target-cardinality=zero-or-many']) {
      expect(printed).toContain(statement);
    }
    expect(Object.values(record.nodes).find((node) => node.kind === 'metric')).toMatchObject({
      label: 'Success rate', value: '92%', detail: '12 of 13 runs', status: 'success',
    });
    expect(Object.values(record.nodes).find((node) => node.kind === 'icon-card')).toMatchObject({
      label: 'Automated checks', icon: 'check', description: 'Every change is verified.',
    });
    const calloutStack = Object.values(record.nodes).find((node) => node.kind === 'callout-stack');
    expect(calloutStack?.callouts).toEqual([
      { id: 'evidence', kind: 'info', text: 'Evidence is complete' },
      { id: 'decision', kind: 'decision', text: 'Ship the release' },
    ]);
    expect(Object.values(record.nodes).find((node) => node.kind === 'ooux-object')).toMatchObject({
      objectRef: 'organization',
      oouxRows: [
        { kind: 'attribute', id: 'org-name', valueType: 'string', role: 'core', traits: [] },
        { kind: 'cta', id: 'invite-member', role: 'admin' },
      ],
    });
    expect(Object.values(record.nodes).find((node) => node.kind === 'entity')).toMatchObject({
      entityRef: 'provider-session',
      entityFields: [
        { id: 'id', name: 'id', valueType: 'string', keys: ['pk'] },
        { id: 'agent-id', name: 'agentId', valueType: 'string', keys: ['fk', 'uk'] },
      ],
    });
    expect(Object.values(record.wires)[0]).toMatchObject({
      source: { cardinality: 'one' }, target: { cardinality: 'zero-or-many' },
    });
    const reapplied = buildRecord(printed, { [record.id]: record });
    expect(content(reapplied)).toEqual(content(record));
    expect(printRecord(reapplied)).toBe(printed);

    const context = { records: { [record.id]: record }, links: [] };
    expect(exportDiagram(record, context, 'agent')).toBe(`\`\`\`canvas\n${printed}\`\`\`\n`);
    expect(exportDiagram(record, context, 'markdown')).toContain('| @provider-session | entity | — |');
    expect(exportDiagram(record, context, 'json')).toBe(JSON.stringify(record, null, 2));

    const edited = buildRecord(EVERY_KEYWORD_DSL
      .replace('callout "Evidence is complete" id=evidence kind=info',
        'callout "Evidence was independently verified" id=evidence kind=info')
      .replace('    callout "Ship the release" id=decision kind=decision\n', '')
      .replace('    callout "Evidence was independently verified" id=evidence kind=info',
        '    callout "Ship the release" id=decision kind=decision\n    callout "Evidence was independently verified" id=evidence kind=info'),
    { [record.id]: record });
    const editedCallouts = Object.values(edited.nodes)
      .find((node) => node.kind === 'callout-stack')?.callouts ?? [];
    expect(editedCallouts.map((callout) => callout.id)).toEqual(['decision', 'evidence']);
    expect(editedCallouts[1].text).toBe('Evidence was independently verified');
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
