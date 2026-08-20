import { describe, expect, it } from 'vitest';
import type { DiagramRecord } from '../../src/canvas.ts';
import { buildRecord } from './dsl-fixture.ts';
import { estimateNodeSize } from './layout.ts';
import { layoutRecord, placementsOf } from './record-graph.ts';

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

function placement(record: DiagramRecord, id: string) {
  return placementsOf(record)[id];
}

function rect(record: DiagramRecord, id: string): Rect {
  const found = placement(record, id);
  return { x: found.position.x, y: found.position.y, ...found.size };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
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

describe('layoutRecord', () => {
  it('lays out children without overlap, inside the root group, flowing top to bottom', () => {
    const laid = buildRecord(DSL);
    const scope = placement(laid, 'browser-sessions');
    const childIds = Object.values(laid.nodes)
      .filter((node) => node.parentId === 'browser-sessions')
      .map((node) => node.id as string);
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
    const cli = placement(laid, 'browser-sessions--browse-cli');
    const broker = placement(laid, 'browser-sessions--session-broker');
    const chrome = placement(laid, 'browser-sessions--chrome-instances');
    expect(cli.position.y).toBeLessThan(broker.position.y);
    expect(broker.position.y).toBeLessThan(chrome.position.y);
  });

  it('is deterministic', () => {
    const record = buildRecord(DSL);
    expect(layoutRecord(record)).toEqual(layoutRecord(record));
  });

  it('uses the requested group breathing room without changing semantic nodes', () => {
    const record = buildRecord(DSL);
    const compact = layoutRecord(record, 24);
    const spacious = layoutRecord(record, 96);
    const childId = 'browser-sessions--browse-cli';

    expect(placement(spacious, childId).position.x)
      .toBeGreaterThan(placement(compact, childId).position.x);
    expect(placement(spacious, 'browser-sessions').size.width)
      .toBeGreaterThan(placement(compact, 'browser-sessions').size.width);
    expect(spacious.nodes).toEqual(compact.nodes);
  });

  it('places a brand-new map at the origin corner of its own coordinate space', () => {
    // Per record, nothing else shares the plane, so the old "below the lowest existing scope"
    // rule reduces to a single fixed corner and a re-applied map can never push another over.
    const laid = buildRecord(DSL);
    expect(placement(laid, 'browser-sessions').position).toEqual({ x: 40, y: 80 });
  });

  it('keeps a re-applied map anchored at its prior position', () => {
    const once = buildRecord(DSL);
    const again = buildRecord(DSL, { [once.id]: once });
    expect(placement(again, 'browser-sessions').position)
      .toEqual(placement(once, 'browser-sessions').position);
  });

  it('flat container: query-only wires still drive dagre rank (status quo)', () => {
    const laid = buildRecord('scope Flat\n  module A\n  module B\n  wire A -> B : read() -> Rows [queries]\n');
    expect(placement(laid, 'flat--a').position.y).toBeLessThan(placement(laid, 'flat--b').position.y);
  });

  it('zoned container: owns wires rank parents above children, non-owns stay rank-free', () => {
    const laid = buildRecord(
      'scope Zoned\n'
      + '  zone "Parent"\n    module "p1"\n  end\n'
      + '  zone "Child"\n    module "c1"\n  end\n'
      + '  module "Loose"\n'
      + '  wire "Parent" -> "Child" : contains [owns]\n'
      + '  wire "Child" -> "Parent" : reads [queries]\n'
      + '  wire "Loose" -> "Parent" : mentions [mentions]\n',
    );
    expect(placement(laid, 'zoned--parent').position.y)
      .toBeLessThan(placement(laid, 'zoned--child').position.y);
    const scope = placement(laid, 'zoned');
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
    const laid = buildRecord(
      'scope "No Owns"\n'
      + '  zone "One"\n    module "a"\n  end\n'
      + '  zone "Two"\n    module "b"\n  end\n'
      + '  zone "Three"\n    module "c"\n  end\n'
      + '  wire "a" -> "b" : q [queries]\n',
    );
    const scope = placement(laid, 'no-owns');
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
    const laid = buildRecord(
      'scope Deep\n'
      + '  zone "Outer"\n'
      + '    zone "Inner"\n'
      + '      module "leaf one"\n'
      + '      module "leaf two"\n'
      + '    end\n'
      + '    module "sibling"\n'
      + '  end\n',
    );
    const outer = placement(laid, 'deep--outer');
    const inner = placement(laid, 'deep--outer--inner');
    const leaf = placement(laid, 'deep--outer--inner--leaf-one');
    expect(inner.size.width).toBeGreaterThanOrEqual(leaf.position.x + leaf.size.width);
    expect(inner.size.height).toBeGreaterThanOrEqual(leaf.position.y + leaf.size.height);
    expect(outer.size.width).toBeGreaterThanOrEqual(inner.position.x + inner.size.width);
    expect(outer.size.height).toBeGreaterThanOrEqual(inner.position.y + inner.size.height);
    const sibling = placement(laid, 'deep--outer--sibling');
    expect(outer.size.height).toBeGreaterThanOrEqual(sibling.position.y + sibling.size.height);
    expect(intersects(rect(laid, 'deep--outer--inner'), rect(laid, 'deep--outer--sibling'))).toBe(false);
  });

  it('lays out stack, row, and grid in source order while preserving pins and outside placements', () => {
    const source = (mode: 'stack' | 'row' | 'grid', gap: number): string => `
scope "Explicit Layout"
  zone "Arranged" layout=${mode}${mode === 'grid' ? ' columns=2' : ''} gap=${gap}
    block "One"
      line "one"
    block "Two"
      line "two"
    block "Three"
      line "three"
  end
  block "Outside"
    line "stable"
`;
    const stack = buildRecord(source('stack', 8));
    const stackIds = ['explicit-layout--arranged--block-one', 'explicit-layout--arranged--block-two', 'explicit-layout--arranged--block-three'];
    expect(placement(stack, stackIds[1]).position.y)
      .toBe(placement(stack, stackIds[0]).position.y + placement(stack, stackIds[0]).size.height + 8);
    expect(placement(stack, stackIds[2]).position.y)
      .toBe(placement(stack, stackIds[1]).position.y + placement(stack, stackIds[1]).size.height + 8);

    const row = buildRecord(source('row', 8));
    expect(placement(row, stackIds[1]).position.x)
      .toBe(placement(row, stackIds[0]).position.x + placement(row, stackIds[0]).size.width + 8);
    expect(placement(row, stackIds[2]).position.x)
      .toBe(placement(row, stackIds[1]).position.x + placement(row, stackIds[1]).size.width + 8);

    const grid = buildRecord(source('grid', 8));
    expect(placement(grid, stackIds[0]).position.y).toBe(placement(grid, stackIds[1]).position.y);
    expect(placement(grid, stackIds[1]).position.x)
      .toBe(placement(grid, stackIds[0]).position.x + placement(grid, stackIds[0]).size.width + 8);
    expect(placement(grid, stackIds[2]).position).toEqual({
      x: placement(grid, stackIds[0]).position.x,
      y: placement(grid, stackIds[0]).position.y + placement(grid, stackIds[0]).size.height + 8,
    });

    const layoutId = grid.views[grid.activeViewId].layoutId;
    const pinnedId = stackIds[1];
    const outsideId = 'explicit-layout--block-outside';
    grid.layouts[layoutId].placements[pinnedId].pinned = true;
    grid.layouts[layoutId].placements[pinnedId].position = { x: 500, y: 56 };
    const pinnedBefore = structuredClone(placement(grid, pinnedId));
    const outsideBefore = structuredClone(placement(grid, outsideId));
    const changed = buildRecord(source('grid', 24), { [grid.id]: grid });
    expect(placement(changed, pinnedId)).toEqual(pinnedBefore);
    expect(placement(changed, outsideId)).toEqual(outsideBefore);
    expect(intersects(rect(changed, stackIds[0]), rect(changed, pinnedId))).toBe(false);
    expect(intersects(rect(changed, stackIds[2]), rect(changed, pinnedId))).toBe(false);
  });

  it('grid layout is deterministic and keeps a bounded aspect ratio', () => {
    const zones = Array.from({ length: 8 }, (_, index) =>
      `  zone "Z${index}"\n    module "m${index}"\n  end\n`).join('');
    const record = buildRecord(`scope Wide\n${zones}`);
    expect(layoutRecord(record)).toEqual(layoutRecord(record));
    const scope = placement(record, 'wide');
    expect(scope.size.width).toBeLessThanOrEqual(2000 + 320 + 40);
    expect(scope.size.height).toBeGreaterThan(160);
  });
});
