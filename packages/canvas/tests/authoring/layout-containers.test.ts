import { describe, expect, it } from 'vitest';
import { buildRecord, layoutInitialRecord, placement, rect, intersects } from './layout-fixture.ts';

describe('layoutInitialRecord', () => {
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
    expect(layoutInitialRecord(record)).toEqual(layoutInitialRecord(record));
    const scope = placement(record, 'wide');
    expect(scope.size.width).toBeLessThanOrEqual(2000 + 320 + 40);
    expect(scope.size.height).toBeGreaterThan(160);
  });
});
