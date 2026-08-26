import { describe, expect, it } from 'vitest';
import { buildNested, orientationOf, planWireRoutes, projectView, resolveAxis, buildRecord, renderRecordSvg, wirePath } from './snapshot-fixture.ts';

describe('renderRecordSvg with a tree node', () => {
  it('renders the tree label and each row exactly as before extraction into the component', () => {
    const dsl = `
scope "Tree Snap"
  tree "Store hierarchy"
    row proj1 project label "Project One"
    row task1 task in-progress parent=proj1
`;
    const svg = renderRecordSvg(buildRecord(dsl));
    expect(svg).toMatch(/<text[^>]*font-family="Inter, sans-serif"[^>]*font-weight="600"[^>]*>Store hierarchy<\/text>/);
    expect(svg).toMatch(/<text[^>]*font-family="SFMono-Regular, Consolas, monospace"[^>]*font-weight="600"[^>]*>Project One<\/text>/);
    expect(svg).toMatch(/<text[^>]*font-family="SFMono-Regular, Consolas, monospace"[^>]*>task1  \[in-progress\]<\/text>/);
  });
});

describe('renderRecordSvg with nested zones', () => {
  it('places deep descendants at accumulated absolute positions', () => {
    const svg = renderRecordSvg(buildNested());
    // panel margin 24: zone-a 40+24, zone-b 30 more, deep node 20 more
    expect(svg).toContain('<rect x="64" y="84" width="400" height="400"');   // zone-a
    expect(svg).toContain('<rect x="94" y="134" width="300" height="250"');  // zone-b inside zone-a
    expect(svg).toContain('<rect x="114" y="174" width="160" height="80"');  // deep node at depth 2
    expect(svg).toContain('<rect x="524" y="124" width="160" height="80"');  // shallow node
  });

  it('renders zone labels and dashes the Standalone zone border', () => {
    const svg = renderRecordSvg(buildNested());
    expect(svg).toContain('Zone A');
    expect(svg).toContain('Zone B');
    expect(svg).toContain('Standalone Tools');
    const standalone = svg.match(/<rect x="524" y="324" width="200" height="150"[^>]*>/);
    expect(standalone?.[0]).toContain('stroke-dasharray');
    // non-standalone zones stay solid
    const zoneA = svg.match(/<rect x="64" y="84" width="400" height="400"[^>]*>/);
    expect(zoneA?.[0]).not.toContain('stroke-dasharray');
  });

  it('draws every internal wire with kind styling and label', () => {
    const record = buildNested();
    const svg = renderRecordSvg(record);
    const paths = svg.match(/<path d="[^"]+" fill="none"/g) ?? [];
    expect(paths).toHaveLength(3);
    expect(svg).toContain('node to node');
    expect(svg).toContain('zone to node');
    expect(svg).toContain('zone to zone');
    // assigns is dashed, queries is dashdot (wire-styles.ts)
    expect(svg).toContain('stroke-dasharray="7 5"');
    expect(svg).toContain('stroke-dasharray="9 4 2 4"');
    const layout = record.layouts[record.views[record.activeViewId].layoutId];
    const plans = planWireRoutes(projectView(record), layout.wireRouteHints, {
      axis: resolveAxis(orientationOf(record)),
    });
    expect(Object.values(plans).every((plan) => plan.collisions === 0)).toBe(true);
    const points = plans['w-node-node'].points.map((point) => ({
      x: point.x + 24, y: point.y + 24,
    }));
    expect(svg).toContain(`<path d="${wirePath(points, 'elbow')}"`);
  });

  it('keeps zone containers behind their children', () => {
    const svg = renderRecordSvg(buildNested());
    const zoneB = svg.indexOf('<rect x="94" y="134"');
    const deep = svg.indexOf('<rect x="114" y="174"');
    expect(zoneB).toBeGreaterThanOrEqual(0);
    expect(deep).toBeGreaterThan(zoneB);
  });
});
