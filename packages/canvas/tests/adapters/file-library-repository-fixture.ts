import { afterEach, vi } from 'vitest';
import type { DiagramRecord, LibraryIndex } from '@novakai/canvas';
import working from '../fixtures/migration/real-v2-working-copy.json' with { type: 'json' };

export function sampleRecord(): DiagramRecord {
  const layoutId = 'layout-default';
  const viewId = 'view-default';
  return {
    schemaVersion: 3,
    id: 'overview' as never,
    name: 'Overview',
    status: 'active',
    revision: 1,
    nodes: {
      root: {
        id: 'root' as never, kind: 'group', label: 'Overview', interfaceIds: [], typeIds: [],
      },
    },
    wires: {},
    interfaces: {},
    types: {},
    layouts: {
      [layoutId]: {
        id: layoutId as never, name: 'Default', strategy: 'manual', placements: {}, wireRouteHints: {},
      },
    },
    views: {
      [viewId]: {
        id: viewId as never,
        name: 'Default',
        layoutId: layoutId as never,
        viewport: { x: 0, y: 0, zoom: 1 },
        collapsedNodeIds: [],
        hiddenKinds: [],
      },
    },
    activeViewId: viewId as never,
    sourceRefs: [],
    appliedOperations: {},
  };
}

export function sampleIndex(): LibraryIndex {
  return {
    schemaVersion: 3,
    revision: 1,
    entries: {
      overview: {
        id: 'overview' as never, name: 'Overview', status: 'active', revision: 1, nodeLabels: ['Overview'],
      },
    },
    links: {},
    migratedOperations: {},
  };
}

/** Stubs `fetch` so every call resolves with the same canned status and JSON body. */
export function stubFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

afterEach(() => vi.unstubAllGlobals());


export { CanvasLoadError, createFileLibraryRepository, diagramRecordSchema, migrateDocumentToLibrary, parseArchitectureDocument } from '@novakai/canvas';
export { working };
