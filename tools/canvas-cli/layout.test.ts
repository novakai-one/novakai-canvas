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

  it('flat container: query-only wires still drive dagre rank (status quo)', () => {
    const { scopes, errors } = parseDsl(
      'scope Flat\n  module A\n  module B\n  wire A -> B : read() -> Rows [queries]\n',
    );
    expect(errors).toEqual([]);
    const result = compile(baseDoc(), scopes);
    const laid = layoutScopes(result.doc, result.touchedScopeIds);
    expect(laid.nodes['flat--a'].position.y).toBeLessThan(laid.nodes['flat--b'].position.y);
  });

  it('zoned container: owns wires rank parents above children, non-owns stay rank-free', () => {
    const { scopes, errors } = parseDsl(
      'scope Zoned\n'
      + '  zone "Parent"\n    module "p1"\n  end\n'
      + '  zone "Child"\n    module "c1"\n  end\n'
      + '  module "Loose"\n'
      + '  wire "Parent" -> "Child" : contains [owns]\n'
      + '  wire "Child" -> "Parent" : reads [queries]\n'
      + '  wire "Loose" -> "Parent" : mentions [mentions]\n',
    );
    expect(errors).toEqual([]);
    const result = compile(baseDoc(), scopes);
    const laid = layoutScopes(result.doc, result.touchedScopeIds);
    const parent = laid.nodes['zoned--parent'];
    const child = laid.nodes['zoned--child'];
    expect(parent.position.y).toBeLessThan(child.position.y);
    // every grid child sits inside the container, no overlaps
    const scope = laid.nodes.zoned;
    const childIds = ['zoned--parent', 'zoned--child', 'zoned--loose'];
    for (const a of childIds) {
      const ra = rect(laid, a);
      expect(ra.x).toBeGreaterThanOrEqual(0);
      expect(ra.y).toBeGreaterThanOrEqual(0);
      expect(ra.x + ra.width).toBeLessThanOrEqual(scope.size.width);
      expect(ra.y + ra.height).toBeLessThanOrEqual(scope.size.height);
      for (const b of childIds) {
        if (a < b) expect(intersects(ra, rect(laid, b)), `${a} vs ${b}`).toBe(false);
      }
    }
  });

  it('zoned container with no owns wires still packs without overlap (R5 fixture)', () => {
    const { scopes, errors } = parseDsl(
      'scope "No Owns"\n'
      + '  zone "One"\n    module "a"\n  end\n'
      + '  zone "Two"\n    module "b"\n  end\n'
      + '  zone "Three"\n    module "c"\n  end\n'
      + '  wire "a" -> "b" : q [queries]\n',
    );
    expect(errors).toEqual([]);
    const result = compile(baseDoc(), scopes);
    const laid = layoutScopes(result.doc, result.touchedScopeIds);
    const scope = laid.nodes['no-owns'];
    const zoneIds = ['no-owns--one', 'no-owns--two', 'no-owns--three'];
    for (const a of zoneIds) {
      const ra = rect(laid, a);
      expect(ra.x + ra.width).toBeLessThanOrEqual(scope.size.width);
      expect(ra.y + ra.height).toBeLessThanOrEqual(scope.size.height);
      for (const b of zoneIds) {
        if (a < b) expect(intersects(ra, rect(laid, b)), `${a} vs ${b}`).toBe(false);
      }
    }
  });

  it('nested zones size bottom-up so deep children stay inside every ancestor', () => {
    const { scopes, errors } = parseDsl(
      'scope Deep\n'
      + '  zone "Outer"\n'
      + '    zone "Inner"\n'
      + '      module "leaf one"\n'
      + '      module "leaf two"\n'
      + '    end\n'
      + '    module "sibling"\n'
      + '  end\n',
    );
    expect(errors).toEqual([]);
    const result = compile(baseDoc(), scopes);
    const laid = layoutScopes(result.doc, result.touchedScopeIds);
    const outer = laid.nodes['deep--outer'];
    const inner = laid.nodes['deep--outer--inner'];
    const leaf = laid.nodes['deep--outer--inner--leaf-one'];
    // inner contains its leaves
    expect(inner.size.width).toBeGreaterThanOrEqual(leaf.position.x + leaf.size.width);
    expect(inner.size.height).toBeGreaterThanOrEqual(leaf.position.y + leaf.size.height);
    // outer contains inner and sibling
    expect(outer.size.width).toBeGreaterThanOrEqual(inner.position.x + inner.size.width);
    expect(outer.size.height).toBeGreaterThanOrEqual(inner.position.y + inner.size.height);
    const sibling = laid.nodes['deep--outer--sibling'];
    expect(outer.size.height).toBeGreaterThanOrEqual(sibling.position.y + sibling.size.height);
    expect(intersects(rect(laid, 'deep--outer--inner'), rect(laid, 'deep--outer--sibling'))).toBe(false);
  });

  it('grid layout is deterministic and keeps a bounded aspect ratio', () => {
    const zones = Array.from({ length: 8 }, (_, index) =>
      `  zone "Z${index}"\n    module "m${index}"\n  end\n`).join('');
    const { scopes, errors } = parseDsl(`scope Wide\n${zones}`);
    expect(errors).toEqual([]);
    const result = compile(baseDoc(), scopes);
    const first = layoutScopes(result.doc, result.touchedScopeIds);
    const second = layoutScopes(result.doc, result.touchedScopeIds);
    expect(second).toEqual(first);
    const scope = first.nodes.wide;
    // 8 zones must wrap before the width runs away; aspect stays bounded
    expect(scope.size.width).toBeLessThanOrEqual(2000 + 320 + 40);
    expect(scope.size.height).toBeGreaterThan(160);
  });
});
