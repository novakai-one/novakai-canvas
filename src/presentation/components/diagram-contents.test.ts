import { describe, expect, it } from 'vitest';
import { asId } from '@novakai/canvas';
import type { NodeId } from '@novakai/canvas';
import type { ProjectedView } from '@novakai/canvas';
import type { DiagramRecord } from '@novakai/canvas';
import { oneLine } from '../shell';
import { contentIndent, diagramContents } from './diagram-contents';

function node(id: string, label: string, parentId?: string) {
  return {
    id: asId<NodeId>(id),
    kind: parentId ? ('module' as const) : ('scope' as const),
    label,
    parentId: parentId ? asId<NodeId>(parentId) : undefined,
    interfaceIds: [],
    typeIds: [],
  };
}

const NODES = [
  node('root', 'A diagram'),
  node('zulu', 'Zulu', 'root'),
  node('alpha', 'Alpha', 'root'),
  node('nested', 'Nested', 'alpha'),
];

const record = {
  nodes: Object.fromEntries(NODES.map((entry) => [entry.id as string, entry])),
} as unknown as DiagramRecord;

const view = {
  nodes: NODES.map((entry) => ({ ...entry, position: { x: 0, y: 0 }, size: { width: 1, height: 1 } })),
} as unknown as ProjectedView;

describe('diagram contents', () => {
  it('leaves out the diagram container itself', () => {
    expect(diagramContents(record, view).map((row) => row.id)).not.toContain('root');
  });

  it('lists outermost first, then alphabetically', () => {
    expect(diagramContents(record, view).map((row) => row.label))
      .toEqual(['Alpha', 'Zulu', 'Nested']);
  });

  it('indents by nesting and stops indenting once a tree is deep', () => {
    expect([0, 1, 2, 3, 9].map(contentIndent)).toEqual([0, 8, 16, 24, 24]);
  });
});

describe('search result labels', () => {
  it('cuts a comment body down to one line', () => {
    const comment = 'Assign a Person to a Mission role. One Person may have zero or many live'
      + '\nPresences; a disposable session is never the team member.';
    const shown = oneLine(comment);
    expect(shown).not.toContain('\n');
    expect(shown.length).toBeLessThanOrEqual(48);
    expect(shown.endsWith('…')).toBe(true);
  });

  it('leaves an ordinary name exactly as it is', () => {
    expect(oneLine('Session broker')).toBe('Session broker');
  });
});
