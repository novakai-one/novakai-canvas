import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument, CanvasNode, WireKind } from '../../src/domain/model';
import { parseDsl } from './dsl-parse.ts';
import { compile } from './compile.ts';
import { layoutScopes } from './layout.ts';
import { renderScopeSvg } from './snapshot.ts';

const DSL = `
scope "Snap & Demo"
  note "Escaping <matters> & renders."
  module "Broker <A>" "Owns leases & grants"
    acquire(AgentId) -> SessionHandle
  module Client
  wire Client -> "Broker <A>" : acquire(AgentId) -> SessionHandle [queries]
`;

function build(): ArchitectureDocument {
  const { scopes, errors } = parseDsl(DSL);
  expect(errors).toEqual([]);
  const empty: ArchitectureDocument = {
    schemaVersion: 1, id: 'doc', name: 'Doc', revision: 1, nodes: {}, interfaces: {}, types: {}, wires: {},
  };
  const result = compile(empty, scopes);
  expect(result.errors).toEqual([]);
  return layoutScopes(result.doc, result.touchedScopeIds);
}

/** Fabricated nested map: zone in zone, a deep node, a Standalone zone, three wires. */
function buildNested(): ArchitectureDocument {
  const node = (
    id: string, kind: CanvasNode['kind'], label: string,
    x: number, y: number, width: number, height: number, parentId?: string,
  ): CanvasNode => ({
    id, kind, label, position: { x, y }, size: { width, height }, parentId, interfaceIds: [], typeIds: [],
  });
  const wire = (id: string, source: string, target: string, label: string, kind: WireKind) =>
    ({ id, source, target, label, kind, routing: 'elbow' as const });
  const nodes = [
    node('map', 'scope', 'Nested Map', 0, 0, 800, 600),
    node('zone-a', 'scope', 'Zone A', 40, 60, 400, 400, 'map'),
    node('zone-b', 'scope', 'Zone B', 30, 50, 300, 250, 'zone-a'),
    node('deep', 'module', 'Deep Node', 20, 40, 160, 80, 'zone-b'),
    node('shallow', 'module', 'Shallow Node', 500, 100, 160, 80, 'map'),
    node('standalone', 'scope', 'Standalone Tools', 500, 300, 200, 150, 'map'),
  ];
  const wires = [
    wire('w-node-node', 'shallow', 'deep', 'node to node', 'queries'),
    wire('w-zone-node', 'zone-a', 'deep', 'zone to node', 'owns'),
    wire('w-zone-zone', 'zone-a', 'standalone', 'zone to zone', 'assigns'),
  ];
  return {
    schemaVersion: 1, id: 'doc', name: 'Doc', revision: 1,
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    interfaces: {}, types: {},
    wires: Object.fromEntries(wires.map((w) => [w.id, w])),
  };
}

describe('renderScopeSvg', () => {
  it('renders every label, signature, and contract, XML-escaped', () => {
    const svg = renderScopeSvg(build(), 'snap-demo');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('Snap &amp; Demo');
    expect(svg).toContain('Broker &lt;A&gt;');
    expect(svg).toContain('acquire(AgentId) → SessionHandle');
    expect(svg).toContain('Escaping &lt;matters&gt; &amp; renders.');
    // no raw unescaped ampersands or angle brackets from labels
    expect(svg).not.toContain('Snap & Demo');
    expect(svg).not.toContain('<A>');
  });

  it('keeps every node card inside the scope panel', () => {
    const svg = renderScopeSvg(build(), 'snap-demo');
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
});

describe('renderScopeSvg with nested zones', () => {
  it('places deep descendants at accumulated absolute positions', () => {
    const svg = renderScopeSvg(buildNested(), 'map');
    // panel margin 24: zone-a 40+24, zone-b 30 more, deep node 20 more
    expect(svg).toContain('<rect x="64" y="84" width="400" height="400"');   // zone-a
    expect(svg).toContain('<rect x="94" y="134" width="300" height="250"');  // zone-b inside zone-a
    expect(svg).toContain('<rect x="114" y="174" width="160" height="80"');  // deep node at depth 2
    expect(svg).toContain('<rect x="524" y="124" width="160" height="80"');  // shallow node
  });

  it('renders zone labels and dashes the Standalone zone border', () => {
    const svg = renderScopeSvg(buildNested(), 'map');
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
    const svg = renderScopeSvg(buildNested(), 'map');
    const polylines = svg.match(/<polyline /g) ?? [];
    expect(polylines).toHaveLength(3);
    expect(svg).toContain('node to node');
    expect(svg).toContain('zone to node');
    expect(svg).toContain('zone to zone');
    // assigns is dashed, queries is dashdot (wire-styles.ts)
    expect(svg).toContain('stroke-dasharray="7 5"');
    expect(svg).toContain('stroke-dasharray="9 4 2 4"');
  });

  it('keeps zone containers behind their children', () => {
    const svg = renderScopeSvg(buildNested(), 'map');
    const zoneB = svg.indexOf('<rect x="94" y="134"');
    const deep = svg.indexOf('<rect x="114" y="174"');
    expect(zoneB).toBeGreaterThanOrEqual(0);
    expect(deep).toBeGreaterThan(zoneB);
  });
});
