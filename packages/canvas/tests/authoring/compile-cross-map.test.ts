import { describe, expect, it } from 'vitest';
import { buildRecords, compile, printRecord, fixture, parseOk } from './compile-fixture.ts';

describe('compile', () => {
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
    const source = `
scope "Agent Messaging"
  entity "Agent" ref=agent
  module Session
  wire Session -> Agent : local wins [queries]
`;
    const built = buildRecords(source, existing);
    const { diagrams, errors } = built.result;
    expect(errors).toEqual([]);
    const [diagram] = diagrams;
    // Local display labels win even when the node's durable address is an @ref.
    expect(Object.values(diagram.wires)[0].source.nodeId).toBe('agent-messaging--session');
    expect(Object.values(diagram.wires)[0].target.nodeId).toBe('agent-messaging--entity-agent');
    expect(diagram.crossDiagramWires).toEqual([]);
    expect(printRecord(built.records['agent-messaging']))
      .toContain('wire "Session" -> @agent : local wins [queries]');
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

});
