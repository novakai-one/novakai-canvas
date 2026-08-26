import { describe, expect, it } from "vitest";
import {
  componentFor,
  exportDiagram,
  listMaps,
  type CrossDiagramLink,
} from "@novakai/canvas";
import { DSL, buildRecord, content, printLibrary, printRecord } from "./dsl-print-fixture.ts";

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
