import { describe, expect, it } from 'vitest';
import { planWireRoutes, projectView, type DiagramRecord } from '../../src/canvas.ts';
import { buildRecord } from './dsl-fixture.ts';
import { blankRecord } from './record-apply.ts';
import { asId, type RecordNode, type RecordPlacement, type RecordWire } from './record-graph.ts';
import { renderRecordSvg } from './snapshot.ts';
import { wirePath } from '../../src/presentation/edges/wire-shape.ts';

const DSL = `
scope "Snap & Demo"
  note "Escaping <matters> & renders."
  module "Broker <A>" "Owns leases & grants"
    acquire(AgentId) -> SessionHandle
  module Client
  wire Client -> "Broker <A>" shape=straight : acquire(AgentId) -> SessionHandle [queries]
`;

function build(): DiagramRecord {
  return buildRecord(DSL);
}

/** Fabricated nested map: zone in zone, a deep node, a Standalone zone, three wires. */
function buildNested(): DiagramRecord {
  const node = (
    id: string, kind: RecordNode['kind'], label: string, parentId?: string,
  ): RecordNode => ({
    id: asId(id),
    kind,
    label,
    ...(parentId ? { parentId: asId<never>(parentId) } : {}),
    interfaceIds: [],
    typeIds: [],
  });
  const place = (
    id: string, x: number, y: number, width: number, height: number,
  ): RecordPlacement => ({
    nodeId: asId(id), position: { x, y }, size: { width, height }, pinned: false,
  });
  const wire = (
    id: string, source: string, target: string, label: string, kind: RecordWire['kind'],
  ): RecordWire => ({
    id: asId(id), kind, label, source: { nodeId: asId(source) }, target: { nodeId: asId(target) },
  });

  const nodes = [
    node('map', 'group', 'Nested Map'),
    node('zone-a', 'group', 'Zone A', 'map'),
    node('zone-b', 'group', 'Zone B', 'zone-a'),
    node('deep', 'module', 'Deep Node', 'zone-b'),
    node('shallow', 'module', 'Shallow Node', 'map'),
    node('standalone', 'group', 'Standalone Tools', 'map'),
  ];
  const placements = [
    place('map', 0, 0, 800, 600),
    place('zone-a', 40, 60, 400, 400),
    place('zone-b', 30, 50, 300, 250),
    place('deep', 20, 40, 160, 80),
    place('shallow', 500, 100, 160, 80),
    place('standalone', 500, 300, 200, 150),
  ];
  const wires = [
    wire('w-node-node', 'shallow', 'deep', 'node to node', 'queries'),
    wire('w-zone-node', 'zone-a', 'deep', 'zone to node', 'owns'),
    wire('w-zone-zone', 'zone-a', 'standalone', 'zone to zone', 'assigns'),
  ];

  const record = blankRecord('map', 'Nested Map');
  return {
    ...record,
    nodes: Object.fromEntries(nodes.map((each) => [each.id, each])),
    wires: Object.fromEntries(wires.map((each) => [each.id, each])),
    layouts: {
      'layout-default': {
        ...record.layouts['layout-default'],
        placements: Object.fromEntries(placements.map((each) => [each.nodeId, each])),
      },
    },
  };
}

describe('renderRecordSvg', () => {
  it('renders every label, signature, and contract, XML-escaped', () => {
    const svg = renderRecordSvg(build());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('Snap &amp; Demo');
    expect(svg).toContain('Broker &lt;A&gt;');
    expect(svg).toContain('acquire(AgentId) → SessionHandle');
    expect(svg).toContain('Escaping &lt;matters&gt; &amp; renders.');
    expect(svg).toContain('<path d="M');
    expect(svg).not.toContain('<polyline');
    // no raw unescaped ampersands or angle brackets from labels
    expect(svg).not.toContain('Snap & Demo');
    expect(svg).not.toContain('<A>');
  });

  it('keeps every node card inside the scope panel', () => {
    const svg = renderRecordSvg(build());
    const rects = [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g)]
      .map((match) => match.slice(1, 5).map(Number));
    const [panel, ...cards] = rects;
    expect(cards.length).toBeGreaterThanOrEqual(3);
    for (const [x, y, width, height] of cards) {
      expect(x).toBeGreaterThanOrEqual(panel[0]);
      expect(y).toBeGreaterThanOrEqual(panel[1]);
      expect(x + width).toBeLessThanOrEqual(panel[0] + panel[2]);
      expect(y + height).toBeLessThanOrEqual(panel[1] + panel[3]);
    }
  });

  it('refuses a record with no single root group rather than guessing one', () => {
    const record = blankRecord('loose', 'Loose');
    expect(() => renderRecordSvg(record)).toThrow('no single root group');
  });

  it('renders dark resolved block styles, multiline text, and a hidden card badge', () => {
    const record = buildRecord(`
scope "Styled Snapshot" layout=stack gap=16
  block "Tasks:" weight=600
    line "• Safety"
    line "• Code"
  block "Refusal rate" size=14 weight=600 align=center vertical-align=center text=green border-color=green border=1 radius=8 padding=12
  module "Prompt" badge=hide
`);
    const block = Object.values(record.nodes).find((node) => node.label === 'Refusal rate');
    if (!block) throw new Error('snapshot fixture block missing');
    const layout = record.layouts[record.views[record.activeViewId].layoutId];
    const placement = layout.placements[block.id];
    placement.size = { ...placement.size, height: 180 };
    placement.sizeMode = 'manual';
    const svg = renderRecordSvg(record);
    expect(svg).toContain('fill="transparent" stroke="#78a886" stroke-width="1" rx="8"');
    expect(svg).toContain('fill="#78a886" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" text-anchor="middle"');
    expect(svg).toContain('>Tasks:</text>');
    expect(svg).toContain('>• Safety</text>');
    expect(svg).toContain('>• Code</text>');
    expect(svg).toContain('>Prompt</text>');
    expect(svg).not.toContain('>MODULE</text>');
    const centered = /<text x="[^"]+" y="([^"]+)"[^>]*>Refusal rate<\/text>/.exec(svg);
    expect(Number(centered?.[1])).toBeGreaterThan(placement.position.y + 40);
  });
});

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
    const plans = planWireRoutes(projectView(record), layout.wireRouteHints);
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
