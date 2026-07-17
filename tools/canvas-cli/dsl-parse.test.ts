import { describe, expect, it } from 'vitest';
import { slugify } from './slug.ts';
import { parseDsl } from './dsl-parse.ts';

const EXAMPLE = `
# a comment line
scope "Agent Browser Sessions"
  note "One session per instance; renders off-screen."
  module "Session broker" "Owns leases and allocation"
    acquire(AgentId) -> SessionHandle
    release(SessionId) -> void
    type SessionHandle { sessionId, cdpEndpoint }
  runtime "Chrome instances"
  resource "sessions.json"
  wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]
`;

describe('slugify', () => {
  it('lowercases and joins alnum runs with dashes', () => {
    expect(slugify('Session broker')).toBe('session-broker');
    expect(slugify('sessions.json')).toBe('sessions-json');
    expect(slugify('  Agent  Browser  Sessions ')).toBe('agent-browser-sessions');
  });
});

describe('parseDsl', () => {
  it('parses the canonical example into the expected AST', () => {
    const { scopes, errors } = parseDsl(EXAMPLE);
    expect(errors).toEqual([]);
    expect(scopes).toHaveLength(1);
    const scope = scopes[0];
    expect(scope.label).toBe('Agent Browser Sessions');
    expect(scope.nodes.map((node) => node.kind)).toEqual(['comment', 'module', 'runtime', 'resource']);
    const broker = scope.nodes[1];
    expect(broker.label).toBe('Session broker');
    expect(broker.description).toBe('Owns leases and allocation');
    expect(broker.interfaces).toEqual([
      { name: 'acquire', accepts: ['AgentId'], returns: ['SessionHandle'] },
      { name: 'release', accepts: ['SessionId'], returns: ['void'] },
    ]);
    expect(broker.types).toEqual([{ name: 'SessionHandle', fields: ['sessionId', 'cdpEndpoint'] }]);
    expect(scope.wires).toEqual([
      {
        source: 'browse CLI', target: 'Session broker',
        contract: 'acquire(AgentId) -> SessionHandle', kind: 'queries', line: 11,
      },
    ]);
  });

  it('accepts bare single-token names and defaults wire kind to references', () => {
    const { scopes, errors } = parseDsl(
      'scope Demo\n  module Broker\n    ping() -> Pong\n  module Client\n  wire Client -> Broker : ping() -> Pong\n',
    );
    expect(errors).toEqual([]);
    expect(scopes[0].nodes.map((node) => node.label)).toEqual(['Broker', 'Client']);
    expect(scopes[0].nodes[0].interfaces[0]).toEqual({ name: 'ping', accepts: [], returns: ['Pong'] });
    expect(scopes[0].wires[0].kind).toBe('references');
  });

  it('reports a wire without a contract, with a hint', () => {
    const { errors } = parseDsl('scope Demo\n  module A\n  module B\n  wire A -> B\n');
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(4);
    expect(errors[0].message).toContain('needs a contract');
    expect(errors[0].hint).toContain('wire A -> B :');
  });

  it('reports member lines outside their container with line numbers', () => {
    const { errors } = parseDsl('ping() -> Pong\ntype T { a }\nwire A -> B : x\n');
    expect(errors).toHaveLength(3);
    expect(errors.map((error) => error.line)).toEqual([1, 2, 3]);
    expect(errors[0].message).toContain('outside');
  });

  it('reports unknown statements listing valid ones', () => {
    const { errors } = parseDsl('scope Demo\n  banana "Split"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('banana');
    expect(errors[0].hint).toContain('module');
  });

  it('reports a bad wire kind', () => {
    const { errors } = parseDsl('scope Demo\n  module A\n  module B\n  wire A -> B : call() -> X [zaps]\n');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('zaps');
  });

  it('reports unbalanced quotes', () => {
    const { errors } = parseDsl('scope "Demo\n');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('quote');
  });

  it('collects multiple errors in one pass', () => {
    const { errors } = parseDsl('scope Demo\n  wire A -> B\n  banana\n');
    expect(errors).toHaveLength(2);
  });

  it('parses multiple scopes', () => {
    const { scopes, errors } = parseDsl('scope One\n  module A\nscope Two\n  module B\n');
    expect(errors).toEqual([]);
    expect(scopes.map((scope) => scope.label)).toEqual(['One', 'Two']);
    expect(scopes[1].nodes[0].label).toBe('B');
  });

  it('parses multi-value accepts and returns', () => {
    const { scopes } = parseDsl('scope Demo\n  module A\n    merge(Left, Right) -> Merged, Report\n');
    expect(scopes[0].nodes[0].interfaces[0]).toEqual({
      name: 'merge', accepts: ['Left', 'Right'], returns: ['Merged', 'Report'],
    });
  });
});
