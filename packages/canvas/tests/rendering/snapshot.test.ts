import { describe, expect, it } from 'vitest';
import { build, buildRecord, blankRecord, renderRecordSvg } from './snapshot-fixture.ts';

describe('renderRecordSvg', () => {
  it('keeps dormant flows byte-identical and emits every active emphasis', () => {
    const base = `scope "Flow Snapshot"
  module A
  module B
  module C
  module D
  module E
  wire A -> B : focal
  wire B -> C : adjacent
  wire D -> E : remote\n`;
    const plain = buildRecord(base);
    const flowed = buildRecord(`${base}  flow "Path"\n    step 1 "flow-snapshot--wire-1"\n  end\n`, { [plain.id]: plain });
    expect(renderRecordSvg(flowed)).toBe(renderRecordSvg(plain));
    flowed.views[flowed.activeViewId].flowId = Object.keys(flowed.flows ?? {})[0] as never;
    const active = renderRecordSvg(flowed);
    expect(['focal', 'context', 'muted'].every((value) => active.includes(`data-emphasis="${value}"`))).toBe(true);
    expect(['focal', 'adjacent', 'remote'].every((label) => active.includes(`>${label}</text>`))).toBe(true);
  });

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

  it('renders the resolved Carbon palette, multiline text, and a hidden card badge', () => {
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
    expect(svg).toContain('fill="#0B0E12"');
    expect(svg).toContain('fill="#6D9FC7" font-family="Inter, sans-serif"');
    expect(svg).toContain('fill="transparent" stroke="#7CAD8A" stroke-width="1" rx="8"');
    expect(svg).toContain('fill="#7CAD8A" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" text-anchor="middle"');
    expect(svg).toContain('>Tasks:</text>');
    expect(svg).toContain('>• Safety</text>');
    expect(svg).toContain('>• Code</text>');
    expect(svg).toContain('>Prompt</text>');
    expect(svg).not.toContain('>MODULE</text>');
    const centered = /<text x="[^"]+" y="([^"]+)"[^>]*>Refusal rate<\/text>/.exec(svg);
    expect(Number(centered?.[1])).toBeGreaterThan(placement.position.y + 40);
  });
});
