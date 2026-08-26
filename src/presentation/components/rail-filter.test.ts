import { describe, expect, it } from 'vitest';
import type { DiagramSummary } from '@novakai/canvas';
import { asId } from '@novakai/canvas';
import type { DiagramId } from '@novakai/canvas';
import { findObjects, groupDiagrams } from './rail-filter';

function entry(id: string, name: string, status: 'active' | 'archived', nodeLabels: string[] = []): DiagramSummary {
  return { id: asId<DiagramId>(id), name, status, revision: 1, nodeLabels };
}

const library: DiagramSummary[] = [
  entry('overview', 'Command Overview', 'active', ['Session broker']),
  entry('browser', 'Agent Browser Sessions', 'active', ['Chrome pool']),
  entry('webhook', 'Webhook Intake', 'active'),
  entry('old-atlas', 'Messaging Atlas', 'archived', ['Tunnel']),
];

describe('groupDiagrams', () => {
  it('splits the library into what you work in and what you put away', () => {
    const groups = groupDiagrams(library, '', 'browser');
    expect(groups.active.map((item) => item.name)).toEqual([
      'Agent Browser Sessions', 'Command Overview', 'Webhook Intake',
    ]);
    expect(groups.archived.map((item) => item.name)).toEqual(['Messaging Atlas']);
  });

  it('narrows by name, case-insensitively', () => {
    const groups = groupDiagrams(library, 'webh', 'browser');
    expect(groups.active.map((item) => item.id)).toContain('webhook');
    expect(groups.active.map((item) => item.id)).not.toContain('overview');
  });

  it('finds a diagram by an object inside it, not only by its title', () => {
    const groups = groupDiagrams(library, 'session broker', 'browser');
    expect(groups.active.map((item) => item.id)).toContain('overview');
  });

  it('never filters away the diagram you are looking at', () => {
    const groups = groupDiagrams(library, 'zzz nothing matches', 'browser');
    expect(groups.active.map((item) => item.id)).toEqual(['browser']);
  });

  it('ignores surrounding whitespace so a stray space does not empty the rail', () => {
    expect(groupDiagrams(library, '   ', 'browser').active).toHaveLength(3);
  });

  it('narrows the archived group too', () => {
    expect(groupDiagrams(library, 'tunnel', 'browser').archived.map((item) => item.id))
      .toEqual(['old-atlas']);
  });
});

describe('findObjects', () => {
  it('names the matching objects and the diagram each one lives in', () => {
    const found = findObjects(library, 'broker');
    expect(found.hits).toEqual([
      { label: 'Session broker', diagramId: 'overview', diagramName: 'Command Overview' },
    ]);
    expect(found.total).toBe(1);
  });

  it('finds nothing for an empty query rather than everything', () => {
    expect(findObjects(library, '   ')).toEqual({ hits: [], total: 0 });
  });

  it('reaches archived diagrams too, because the object is still somewhere', () => {
    expect(findObjects(library, 'tunnel').hits.map((hit) => hit.diagramName))
      .toEqual(['Messaging Atlas']);
  });

  /** A cap that hides how much it hid reads as "that is everything" when it is not. */
  it('reports the full total even when it returns a capped list', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      entry(`d${index}`, `Diagram ${index}`, 'active', ['Shared name']));
    const found = findObjects(many, 'shared', 4);
    expect(found.hits).toHaveLength(4);
    expect(found.total).toBe(9);
  });
});
