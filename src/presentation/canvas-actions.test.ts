import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../domain/model';
import { emptyArchitecture } from '../domain/defaults';
import { createCanvasNode } from './canvas-actions';

const document: ArchitectureDocument = {
  ...structuredClone(emptyArchitecture), id: 'map', name: 'Map',
};

describe('createCanvasNode', () => {
  it.each(['module', 'object', 'runtime', 'resource', 'comment', 'group'] as const)('creates a %s inside the active map', (kind) => {
    const created = createCanvasNode(document, 'scope-a', kind, `${kind}-1`);
    expect(created.node.parentId).toBe('scope-a');
    expect(created.node.id).toBe(`${kind}-1`);
    expect(created.placement.nodeId).toBe(created.node.id);
    expect(created.node.kind).toBe(kind === 'group' ? 'scope' : kind);
  });
});
