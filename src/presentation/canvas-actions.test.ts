import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../domain/model';
import { createCanvasNode } from './canvas-actions';

const document: ArchitectureDocument = {
  schemaVersion: 1,
  id: 'map',
  name: 'Map',
  revision: 0,
  nodes: {},
  interfaces: {},
  types: {},
  wires: {},
};

describe('createCanvasNode', () => {
  it.each(['module', 'comment'] as const)('creates a %s inside the active map', (kind) => {
    const created = createCanvasNode(document, 'scope-a', kind, `${kind}-1`);
    expect(created.parentId).toBe('scope-a');
    expect(created.id).toBe(`${kind}-1`);
  });
});
