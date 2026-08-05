import { describe, expect, it } from 'vitest';
import { parseArchitectureDocument } from './schema';

describe('architecture document migration', () => {
  it('moves legacy node geometry into one default layout without changing meaning', () => {
    const migrated = parseArchitectureDocument({
      schemaVersion: 1,
      id: 'diagram-one',
      name: 'Diagram one',
      revision: 7,
      nodes: {
        module: {
          id: 'module',
          kind: 'module',
          label: 'Module',
          position: { x: 120, y: 240 },
          size: { width: 320, height: 180 },
          interfaceIds: [],
          typeIds: [],
        },
      },
      interfaces: {},
      types: {},
      wires: {},
    });

    expect(migrated).toMatchObject({
      schemaVersion: 2,
      id: 'diagram-one',
      revision: 7,
      activeLayoutId: 'layout-default',
      nodes: {
        module: {
          id: 'module',
          kind: 'module',
          label: 'Module',
          interfaceIds: [],
          typeIds: [],
        },
      },
      layouts: {
        'layout-default': {
          id: 'layout-default',
          name: 'Default',
          strategy: 'manual',
          placements: {
            module: {
              nodeId: 'module',
              position: { x: 120, y: 240 },
              size: { width: 320, height: 180 },
              pinned: false,
            },
          },
          wireRouteHints: {},
        },
      },
    });
    expect(migrated.nodes.module).not.toHaveProperty('position');
    expect(migrated.nodes.module).not.toHaveProperty('size');
  });
});
