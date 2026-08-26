import { describe, expect, it } from 'vitest';
import { compile, fixture, parseOk } from './compile-fixture.ts';

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

});
