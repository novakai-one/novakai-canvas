import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../src/domain/model';
import { parseDsl } from './dsl-parse.ts';
import { compile } from './compile.ts';
import { estimateNodeSize, layoutScopes } from './layout.ts';

const DSL = `
scope "Browser Sessions"
  note "One session per instance; renders off-screen so the foreground never moves."
  module "browse CLI" "Entry point for agents"
    goto(Url) -> ActionResult
  module "Session broker" "Owns leases and allocation"
    acquire(AgentId) -> SessionHandle
    release(SessionId) -> void
  module "CDP control"
    act(SessionId, BrowserCommand) -> ActionResult
  runtime "Chrome instances"
  resource "sessions.json"
  wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]
  wire "Session broker" -> "Chrome instances" : launch(LaunchSpec) -> BrowserInstance [owns]
  wire "CDP control" -> "Chrome instances" : CDP Page.* commands [executes]
`;

interface Rect { x: number; y: number; width: number; height: number }

function rect(doc: ArchitectureDocument, id: string): Rect {
  const node = doc.nodes[id];
  return { x: node.position.x, y: node.position.y, ...node.size };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function baseDoc(): ArchitectureDocument {
  return {
    schemaVersion: 1, id: 'doc', name: 'Doc', revision: 1,
    nodes: {
      'existing-scope': {
        id: 'existing-scope', kind: 'scope', label: 'Existing',
        position: { x: 300, y: 120 }, size: { width: 500, height: 400 }, interfaceIds: [], typeIds: [],
      },
      'existing-child': {
        id: 'existing-child', kind: 'module', label: 'Child', parentId: 'existing-scope',
        position: { x: 40, y: 60 }, size: { width: 200, height: 100 }, interfaceIds: [], typeIds: [],
      },
    },
    interfaces: {}, types: {}, wires: {},
  };
}

function compiled() {
  const { scopes, errors } = parseDsl(DSL);
  expect(errors).toEqual([]);
  const result = compile(baseDoc(), scopes);
  expect(result.errors).toEqual([]);
  return result;
}

describe('estimateNodeSize', () => {
  it('budgets generously enough for a described two-interface card', () => {
    const size = estimateNodeSize(
      'Threads', 'Groups messages into ordered conversations agents can follow.',
      ['create(CreateThread) -> Thread', 'append(ThreadId, Envelope) -> Receipt'], [],
    );
    expect(size.height).toBeGreaterThanOrEqual(150);
    expect(size.width).toBeGreaterThanOrEqual(200);
    expect(size.width).toBeLessThanOrEqual(420);
  });
});

describe('layoutScopes', () => {
  it('lays out children without overlap, inside the scope, flowing top to bottom', () => {
    const { doc, touchedScopeIds } = compiled();
    const laid = layoutScopes(doc, touchedScopeIds);
    const scope = laid.nodes['browser-sessions'];
    const childIds = Object.values(laid.nodes)
      .filter((node) => node.parentId === 'browser-sessions')
      .map((node) => node.id);
    expect(childIds.length).toBe(6);
    for (const a of childIds) {
      for (const b of childIds) {
        if (a < b) expect(intersects(rect(laid, a), rect(laid, b)), `${a} vs ${b}`).toBe(false);
      }
    }
    for (const id of childIds) {
      const child = rect(laid, id);
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(0);
      expect(child.x + child.width).toBeLessThanOrEqual(scope.size.width);
      expect(child.y + child.height).toBeLessThanOrEqual(scope.size.height);
    }
    const cli = laid.nodes['browser-sessions--browse-cli'];
    const broker = laid.nodes['browser-sessions--session-broker'];
    const chrome = laid.nodes['browser-sessions--chrome-instances'];
    expect(cli.position.y).toBeLessThan(broker.position.y);
    expect(broker.position.y).toBeLessThan(chrome.position.y);
  });

  it('is deterministic', () => {
    const { doc, touchedScopeIds } = compiled();
    const first = layoutScopes(doc, touchedScopeIds);
    const second = layoutScopes(doc, touchedScopeIds);
    expect(second).toEqual(first);
  });

  it('places a new scope below the lowest existing top-level node and never moves others', () => {
    const { doc, touchedScopeIds } = compiled();
    const laid = layoutScopes(doc, touchedScopeIds);
    expect(laid.nodes['existing-scope'].position).toEqual({ x: 300, y: 120 });
    expect(laid.nodes['existing-child']).toEqual(doc.nodes['existing-child']);
    const scope = laid.nodes['browser-sessions'];
    expect(scope.position.x).toBe(40);
    expect(scope.position.y).toBe(120 + 400 + 80);
  });

  it('keeps a re-applied scope anchored at its prior position', () => {
    const { doc, touchedScopeIds } = compiled();
    const once = layoutScopes(doc, touchedScopeIds);
    const { scopes } = parseDsl(DSL);
    const again = compile(once, scopes);
    expect(again.errors).toEqual([]);
    const relaid = layoutScopes(again.doc, again.touchedScopeIds);
    expect(relaid.nodes['browser-sessions'].position).toEqual(once.nodes['browser-sessions'].position);
  });
});
