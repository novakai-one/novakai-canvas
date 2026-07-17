import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../src/domain/model';
import { parseDsl } from './dsl-parse.ts';
import { compile } from './compile.ts';

function fixture(): ArchitectureDocument {
  const position = { x: 0, y: 0 };
  const size = { width: 100, height: 100 };
  return {
    schemaVersion: 1,
    id: 'test-doc',
    name: 'Test doc',
    revision: 7,
    nodes: {
      'project-scope': {
        id: 'project-scope', kind: 'scope', label: 'Novakai IDE',
        position: { x: 40, y: 40 }, size: { width: 800, height: 600 }, interfaceIds: [], typeIds: [],
      },
      planning: {
        id: 'planning', kind: 'module', label: 'Planning', parentId: 'project-scope',
        position, size, interfaceIds: ['planning-create'], typeIds: [],
      },
      session: {
        id: 'session', kind: 'module', label: 'Session', parentId: 'project-scope',
        position, size, interfaceIds: [], typeIds: [],
      },
      'messaging-scope': {
        id: 'messaging-scope', kind: 'scope', label: 'Agent Messaging',
        position: { x: 40, y: 700 }, size: { width: 800, height: 400 }, interfaceIds: [], typeIds: [],
      },
      'msg-agents': {
        id: 'msg-agents', kind: 'module', label: 'Agents', parentId: 'messaging-scope',
        position, size, interfaceIds: ['agents-notify'], typeIds: ['agents-envelope'],
      },
    },
    interfaces: {
      'planning-create': { id: 'planning-create', ownerId: 'planning', name: 'create', accepts: ['Plan'], returns: ['PlanId'] },
      'agents-notify': { id: 'agents-notify', ownerId: 'msg-agents', name: 'notify', accepts: ['Message'], returns: ['void'] },
    },
    types: {
      'agents-envelope': { id: 'agents-envelope', name: 'Envelope', fields: ['id', 'from'] },
    },
    wires: {
      'session-agents': {
        id: 'session-agents', source: 'session', target: 'msg-agents',
        label: 'notify(Message) -> void', kind: 'queries', routing: 'elbow',
      },
    },
  };
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
    const { doc, errors, touchedScopeIds, createdScopeIds } = compile(fixture(), scopes);
    expect(errors).toEqual([]);
    expect(touchedScopeIds).toEqual(['browser-sessions']);
    expect(createdScopeIds).toEqual(['browser-sessions']);

    const scope = doc.nodes['browser-sessions'];
    expect(scope.kind).toBe('scope');
    const broker = doc.nodes['browser-sessions--session-broker'];
    expect(broker.parentId).toBe('browser-sessions');
    expect(broker.description).toBe('Owns leases');
    expect(broker.interfaceIds).toEqual(['browser-sessions--session-broker--if-acquire']);
    expect(broker.typeIds).toEqual(['browser-sessions--session-broker--type-lease']);
    expect(doc.interfaces['browser-sessions--session-broker--if-acquire']).toEqual({
      id: 'browser-sessions--session-broker--if-acquire',
      ownerId: 'browser-sessions--session-broker',
      name: 'acquire', accepts: ['AgentId'], returns: ['SessionHandle'],
    });
    const wires = Object.values(doc.wires).filter((wire) => wire.id.startsWith('browser-sessions--wire-'));
    expect(wires).toHaveLength(1);
    expect(wires[0]).toMatchObject({
      source: 'browser-sessions--cdp-control',
      target: 'browser-sessions--session-broker',
      label: 'acquire(AgentId) -> SessionHandle',
      kind: 'references', routing: 'elbow',
    });
    const note = Object.values(doc.nodes).find((node) => node.kind === 'comment' && node.parentId === 'browser-sessions');
    expect(note?.label).toBe('One session per instance.');
  });

  it('re-applies an existing scope keeping scope and same-slug child ids', () => {
    const scopes = parseOk(`
scope "Agent Messaging"
  module Agents "Rebuilt"
    notify(Envelope) -> Receipt
  module Router
  wire Router -> Agents : notify(Envelope) -> Receipt [executes]
`);
    const { doc, errors, createdScopeIds } = compile(fixture(), scopes);
    expect(errors).toEqual([]);
    expect(createdScopeIds).toEqual([]);
    expect(doc.nodes['messaging-scope'].label).toBe('Agent Messaging');
    expect(doc.nodes['msg-agents']).toBeDefined();
    expect(doc.nodes['msg-agents'].description).toBe('Rebuilt');
    // old members replaced, no orphans
    expect(doc.interfaces['agents-notify']).toBeUndefined();
    expect(doc.types['agents-envelope']).toBeUndefined();
    // cross-scope wire survives, still pointing at the reused id
    expect(doc.wires['session-agents']).toBeDefined();
    expect(doc.wires['session-agents'].target).toBe('msg-agents');
    // untouched scope intact
    expect(doc.nodes.planning).toEqual(fixture().nodes.planning);
    expect(doc.interfaces['planning-create']).toEqual(fixture().interfaces['planning-create']);
  });

  it('drops a cross-scope wire only when the endpoint truly disappeared, with a warning', () => {
    const scopes = parseOk('scope "Agent Messaging"\n  module Router\n');
    const { doc, errors, warnings } = compile(fixture(), scopes);
    expect(errors).toEqual([]);
    expect(doc.wires['session-agents']).toBeUndefined();
    expect(warnings.join(' ')).toContain('session');
  });

  it('resolves wire endpoints doc-wide for cross-scope wires', () => {
    const scopes = parseOk(`
scope "Browser Sessions"
  module Viewer
  wire Viewer -> Planning : create(Plan) -> PlanId
`);
    const { doc, errors } = compile(fixture(), scopes);
    expect(errors).toEqual([]);
    const wire = Object.values(doc.wires).find((candidate) => candidate.id.startsWith('browser-sessions--wire-'));
    expect(wire?.target).toBe('planning');
  });

  it('errors on unresolved wire endpoints with close candidates', () => {
    const scopes = parseOk('scope Demo\n  module Alpha\n  wire Alpha -> Plannning : create(Plan) -> PlanId\n');
    const { errors } = compile(fixture(), scopes);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Plannning');
    expect(errors[0].hint).toContain('Planning');
  });

  it('errors on duplicate node labels within one scope', () => {
    const scopes = parseOk('scope Demo\n  module Broker\n  object "Broker"\n');
    const { errors } = compile(fixture(), scopes);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Broker');
  });
});
