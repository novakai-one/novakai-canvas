import { describe, expect, it } from 'vitest';
import { buildRecords, compile, fixture, parseOk } from './compile-fixture.ts';

describe('compile', () => {
  it('compiles nested zones as group nodes with parentId chains', () => {
    const scopes = parseOk(`
scope "Mission Map"
  zone "Stores"
    module "missions.jsonl"
      type Mission { id, title }
    zone "Archive"
      module "old store"
    end
  end
  module "Mission Room"
  wire "missions.jsonl" -> "Mission Room" : read() -> Rows [queries]
  wire "Stores" -> "Mission Room" : grouped [owns]
`);
    const { diagrams, errors } = compile(scopes, fixture());
    expect(errors).toEqual([]);
    const [{ nodes, wires }] = diagrams;
    const stores = nodes['mission-map--stores'];
    expect(stores.kind).toBe('group');
    expect(stores.parentId).toBe('mission-map');
    const archive = nodes['mission-map--stores--archive'];
    expect(archive.kind).toBe('group');
    expect(archive.parentId).toBe('mission-map--stores');
    expect(nodes['mission-map--stores--missions-jsonl'].parentId).toBe('mission-map--stores');
    expect(nodes['mission-map--stores--archive--old-store'].parentId).toBe('mission-map--stores--archive');
    expect(Object.values(wires)).toHaveLength(2);
    // A zone endpoint resolves by label just like any other node.
    expect(Object.values(wires).find((wire) => wire.kind === 'owns')?.source.nodeId)
      .toBe('mission-map--stores');
  });

  it('keeps nested zone and node ids stable across re-apply', () => {
    const dsl = `
scope "Mission Map"
  zone "Stores"
    module "missions.jsonl"
  end
`;
    const first = buildRecords(dsl);
    const second = compile(parseOk(dsl), first.records);
    expect(second.errors).toEqual([]);
    const [{ nodes }] = second.diagrams;
    expect(nodes['mission-map--stores']).toBeDefined();
    expect(nodes['mission-map--stores--missions-jsonl']).toBeDefined();
  });

  it('rejects a zone label duplicating a node label in the same map', () => {
    const scopes = parseOk('scope Demo\n  module Stores\n  zone "Stores"\n  end\n');
    const { errors } = compile(scopes, fixture());
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('duplicate label "Stores"');
    expect(errors[0].hint).toContain('unique within a map');
  });

  it('rejects duplicate labels across sibling zones in one map', () => {
    const scopes = parseOk('scope Demo\n  zone A\n    module "Thing"\n  end\n  zone B\n    module "Thing"\n  end\n');
    const { errors } = compile(scopes, fixture());
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('duplicate label "Thing"');
  });

  it('allows the same label in different maps applied together', () => {
    const scopes = parseOk('scope One\n  module Shared\nscope Two\n  module Shared\n');
    const { errors, diagrams } = compile(scopes, fixture());
    expect(errors).toEqual([]);
    expect(diagrams.map((each) => each.id)).toEqual(['one', 'two']);
  });
});
