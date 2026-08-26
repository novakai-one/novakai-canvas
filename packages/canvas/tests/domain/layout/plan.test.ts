import { describe, expect, it } from 'vitest';
import { records, graphNamed, planned, defaultLayoutOptions, graphOfDiagram, layoutStrategyFor, planSliceLayout } from './plan-fixture.ts';
import type { LayoutSliceTarget } from './plan-fixture.ts';

describe('layout strategies', () => {
  it.each(records)('%s: proposes byte-identical geometry for the same graph twice', (_name, record) => {
    const graph = graphOfDiagram(record);

    for (const strategy of ['manual', 'hierarchy', 'flow'] as const) {
      const first = planSliceLayout(graph, { kind: 'diagram' }, { strategy });
      const second = planSliceLayout(graph, { kind: 'diagram' }, { strategy });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });

  it('is a pure function of graph, target and options', () => {
    const graph = graphNamed('command-overview');
    const hierarchy = layoutStrategyFor('hierarchy');
    const target: LayoutSliceTarget = { kind: 'diagram' };

    expect(JSON.stringify(hierarchy(graph, target, defaultLayoutOptions)))
      .toBe(JSON.stringify(hierarchy(graph, target, defaultLayoutOptions)));
    // The strategy did not edit what it was handed.
    expect(graph.placements).toEqual(graphNamed('command-overview').placements);
  });

  it('leaves a manual layout exactly where its author put it', () => {
    const graph = graphNamed('command-overview');
    const plan = planSliceLayout(graph, { kind: 'diagram' }, { strategy: 'manual' });

    expect(plan).toMatchObject({ status: 'planned', affectedNodeIds: [] });
    expect(planned(plan)).toEqual(graph.placements);
  });

  it('arranges the whole diagram and gives hierarchy and flow different answers', () => {
    const graph = graphNamed('command-overview');
    const hierarchy = planned(planSliceLayout(graph, { kind: 'diagram' }, { strategy: 'hierarchy' }));
    const flow = planned(planSliceLayout(graph, { kind: 'diagram' }, { strategy: 'flow' }));

    expect(Object.keys(hierarchy).sort()).toEqual(Object.keys(graph.placements).sort());
    expect(JSON.stringify(flow)).not.toBe(JSON.stringify(hierarchy));
    expect(JSON.stringify(hierarchy)).not.toBe(JSON.stringify(graph.placements));
  });
});
