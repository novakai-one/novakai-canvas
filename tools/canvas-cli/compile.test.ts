import { describe, expect, it } from 'vitest';
import type { DiagramRecord } from '../../src/canvas.ts';
import { parseDsl } from './dsl-parse.ts';
import { compile } from './compile.ts';
import { buildRecords } from './dsl-fixture.ts';

/**
 * Two records standing in for the shape of the real library: one map holding `Session`, another
 * holding `Agents`, so a wire between them has to cross a record boundary.
 */
function fixture(): Record<string, DiagramRecord> {
  return buildRecords(`
scope "Novakai IDE"
  module Planning
    create(Plan) -> PlanId
  module Session

scope "Agent Messaging"
  module Agents
    notify(Message) -> void
    type Envelope { id, from }
`).records;
}

function parseOk(source: string) {
  const { scopes, errors } = parseDsl(source);
  expect(errors).toEqual([]);
  return scopes;
}

describe('compile', () => {
  it('compiles a new scope with derived ids, parent wiring, and wire defaults', () => {
    const scopes = parseOk(`
scope "Browser Sessions"
  note "One session per instance."
  module "Session broker" "Owns leases"
    acquire(AgentId) -> SessionHandle
    type Lease { agentId, ttl }
  module "CDP control"
  wire "CDP control" -> "Session broker" : acquire(AgentId) -> SessionHandle
`);
    const { diagrams, errors, createdDiagramIds } = compile(scopes, fixture());
    expect(errors).toEqual([]);
    expect(createdDiagramIds).toEqual(['browser-sessions']);
    expect(diagrams).toHaveLength(1);

    const [diagram] = diagrams;
    expect(diagram.id).toBe('browser-sessions');
    expect(diagram.name).toBe('Browser Sessions');
    expect(diagram.nodes['browser-sessions'].kind).toBe('group');
    const broker = diagram.nodes['browser-sessions--session-broker'];
    expect(broker.parentId).toBe('browser-sessions');
    expect(broker.description).toBe('Owns leases');
    expect(broker.interfaceIds).toEqual(['browser-sessions--session-broker--if-acquire']);
    expect(broker.typeIds).toEqual(['browser-sessions--session-broker--type-lease']);
    expect(diagram.interfaces['browser-sessions--session-broker--if-acquire']).toEqual({
      id: 'browser-sessions--session-broker--if-acquire',
      ownerId: 'browser-sessions--session-broker',
      name: 'acquire', accepts: ['AgentId'], returns: ['SessionHandle'],
    });
    const wires = Object.values(diagram.wires);
    expect(wires).toHaveLength(1);
    expect(wires[0]).toMatchObject({
      source: { nodeId: 'browser-sessions--cdp-control' },
      target: { nodeId: 'browser-sessions--session-broker' },
      label: 'acquire(AgentId) -> SessionHandle',
      kind: 'references',
    });
    const note = Object.values(diagram.nodes).find((node) => node.kind === 'comment');
    expect(note?.label).toBe('One session per instance.');
  });

  it('re-applies an existing scope keeping the diagram id and same-slug child ids', () => {
    const existing = fixture();
    const scopes = parseOk(`
scope "Agent Messaging"
  module Agents "Rebuilt"
    notify(Envelope) -> Receipt
  module Router
  wire Router -> Agents : notify(Envelope) -> Receipt [executes]
`);
    const { diagrams, errors, createdDiagramIds } = compile(scopes, existing);
    expect(errors).toEqual([]);
    expect(createdDiagramIds).toEqual([]);

    const [diagram] = diagrams;
    expect(diagram.id).toBe('agent-messaging');
    const agentsId = 'agent-messaging--agents';
    expect(diagram.nodes[agentsId]).toBeDefined();
    expect(diagram.nodes[agentsId].description).toBe('Rebuilt');
    // Old members are replaced wholesale, so no orphaned interface or type survives.
    expect(diagram.interfaces[`${agentsId}--if-notify`]).toBeDefined();
    expect(diagram.types[`${agentsId}--type-envelope`]).toBeUndefined();
    // The untouched map is not in the result at all: apply writes only what the DSL declared.
    expect(diagrams.map((each) => each.id)).toEqual(['agent-messaging']);
  });

  it('turns a wire naming a node in another map into a cross-diagram relationship', () => {
    const scopes = parseOk(`
scope "Browser Sessions"
  module Viewer
  wire Viewer -> Planning : create(Plan) -> PlanId
`);
    const { diagrams, errors } = compile(scopes, fixture());
    expect(errors).toEqual([]);
    const [diagram] = diagrams;
    // A wire belongs to exactly one record, so this one is not in the record at all.
    expect(Object.values(diagram.wires)).toHaveLength(0);
    expect(diagram.crossDiagramWires).toEqual([{
      kind: 'references',
      label: 'create(Plan) -> PlanId',
      source: { diagramId: 'browser-sessions', nodeId: 'browser-sessions--viewer' },
      target: { diagramId: 'novakai-ide', nodeId: 'novakai-ide--planning' },
    }]);
  });

  it('resolves an endpoint inside the applied map before looking at any other map', () => {
    const existing = fixture();
    const scopes = parseOk(`
scope "Agent Messaging"
  module Agents
  module Session
  wire Session -> Agents : local wins [queries]
`);
    const { diagrams, errors } = compile(scopes, existing);
    expect(errors).toEqual([]);
    const [diagram] = diagrams;
    // "Session" also exists in Novakai IDE; the local node is the one that wins.
    expect(Object.values(diagram.wires)[0].source.nodeId).toBe('agent-messaging--session');
    expect(diagram.crossDiagramWires).toEqual([]);
  });

  it('errors on unresolved wire endpoints with close candidates', () => {
    const scopes = parseOk('scope Demo\n  module Alpha\n  wire Alpha -> Plannning : create(Plan) -> PlanId\n');
    const { errors } = compile(scopes, fixture());
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Plannning');
    expect(errors[0].hint).toContain('Planning');
  });

  it('errors on duplicate node labels within one scope', () => {
    const scopes = parseOk('scope Demo\n  module Broker\n  object "Broker"\n');
    const { errors } = compile(scopes, fixture());
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Broker');
  });

  it('compiles nested zones as group nodes with parentId chains', () => {
    const scopes = parseOk(`
scope "Mission Map"
  zone "Stores"
    module "missions.jsonl"
      type Mission { id, title }
    zone "Archive"
      module "old store"
    end
  end
  module "Mission Room"
  wire "missions.jsonl" -> "Mission Room" : read() -> Rows [queries]
  wire "Stores" -> "Mission Room" : grouped [owns]
`);
    const { diagrams, errors } = compile(scopes, fixture());
    expect(errors).toEqual([]);
    const [{ nodes, wires }] = diagrams;
    const stores = nodes['mission-map--stores'];
    expect(stores.kind).toBe('group');
    expect(stores.parentId).toBe('mission-map');
    const archive = nodes['mission-map--stores--archive'];
    expect(archive.kind).toBe('group');
    expect(archive.parentId).toBe('mission-map--stores');
    expect(nodes['mission-map--stores--missions-jsonl'].parentId).toBe('mission-map--stores');
    expect(nodes['mission-map--stores--archive--old-store'].parentId).toBe('mission-map--stores--archive');
    expect(Object.values(wires)).toHaveLength(2);
    // A zone endpoint resolves by label just like any other node.
    expect(Object.values(wires).find((wire) => wire.kind === 'owns')?.source.nodeId)
      .toBe('mission-map--stores');
  });

  it('keeps nested zone and node ids stable across re-apply', () => {
    const dsl = `
scope "Mission Map"
  zone "Stores"
    module "missions.jsonl"
  end
`;
    const first = buildRecords(dsl);
    const second = compile(parseOk(dsl), first.records);
    expect(second.errors).toEqual([]);
    const [{ nodes }] = second.diagrams;
    expect(nodes['mission-map--stores']).toBeDefined();
    expect(nodes['mission-map--stores--missions-jsonl']).toBeDefined();
  });

  it('rejects a zone label duplicating a node label in the same map', () => {
    const scopes = parseOk('scope Demo\n  module Stores\n  zone "Stores"\n  end\n');
    const { errors } = compile(scopes, fixture());
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('duplicate label "Stores"');
    expect(errors[0].hint).toContain('unique within a map');
  });

  it('rejects duplicate labels across sibling zones in one map', () => {
    const scopes = parseOk('scope Demo\n  zone A\n    module "Thing"\n  end\n  zone B\n    module "Thing"\n  end\n');
    const { errors } = compile(scopes, fixture());
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('duplicate label "Thing"');
  });

  it('allows the same label in different maps applied together', () => {
    const scopes = parseOk('scope One\n  module Shared\nscope Two\n  module Shared\n');
    const { errors, diagrams } = compile(scopes, fixture());
    expect(errors).toEqual([]);
    expect(diagrams.map((each) => each.id)).toEqual(['one', 'two']);
  });
});
