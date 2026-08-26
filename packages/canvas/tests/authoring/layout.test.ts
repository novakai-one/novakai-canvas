import { describe, expect, it } from 'vitest';
import { DSL, buildRecord, layoutInitialRecord, placement, rect, intersects } from './layout-fixture.ts';

describe('layoutInitialRecord', () => {
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
    expect(layoutInitialRecord(record)).toEqual(layoutInitialRecord(record));
  });

  it('uses the requested group breathing room without changing semantic nodes', () => {
    const record = buildRecord(DSL);
    const compact = layoutInitialRecord(record, 24);
    const spacious = layoutInitialRecord(record, 96);
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

  it('keeps manual survivor geometry while placing additions without overlap', () => {
    const once = buildRecord(DSL);
    const manualId = 'browser-sessions--browse-cli';
    const layoutId = once.views[once.activeViewId].layoutId;
    once.layouts[layoutId].placements[manualId] = {
      ...once.layouts[layoutId].placements[manualId],
      position: { x: 500, y: 420 }, size: { width: 360, height: 190 },
      sizeMode: 'manual', pinned: true,
    };
    const again = buildRecord(`${DSL}\n  module "Added later"\n`, { [once.id]: once });
    expect(placement(again, 'browser-sessions').position)
      .toEqual(placement(once, 'browser-sessions').position);
    expect(placement(again, manualId)).toEqual(placement(once, manualId));
    expect(intersects(rect(again, manualId), rect(again, 'browser-sessions--added-later')))
      .toBe(false);
    expect(placement(again, 'browser-sessions').size.height)
      .toBeGreaterThanOrEqual(placement(once, 'browser-sessions').size.height);
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

});
