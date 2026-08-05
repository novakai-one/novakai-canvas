import { describe, expect, it } from 'vitest';
import type { DiagramSummary } from '../../application/canvas-library';
import { asId } from '../../domain/id-cast';
import type { DiagramId } from '../../domain/ids';
import { groupDiagrams } from './rail-filter';

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
