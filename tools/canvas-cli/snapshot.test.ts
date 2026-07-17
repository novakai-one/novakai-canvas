import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../src/domain/model';
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
