import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileLibraryRepository } from './file-library-repository.ts';
import { CanvasLoadError } from './http-json-repository.ts';
import { diagramRecordSchema } from '../domain/record-schema.ts';
import { migrateDocumentToLibrary } from '../domain/migrate/v2-to-v3.ts';
import { parseArchitectureDocument } from '../domain/schema.ts';
import type { DiagramRecord, LibraryIndex } from '../domain/records.ts';
import working from '../domain/migrate/fixtures/real-v2-working-copy.json' with { type: 'json' };

function sampleRecord(): DiagramRecord {
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

function sampleIndex(): LibraryIndex {
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
function stubFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('file library repository', () => {
  it('round-trips a library index through GET/PUT /api/library', async () => {
    const index = sampleIndex();
    let stored: unknown;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        stored = JSON.parse(init.body as string);
        return { ok: true, status: 200, json: async () => undefined };
      }
      return { ok: true, status: 200, json: async () => stored ?? index };
    }));
    const repository = createFileLibraryRepository('/api');

    const outcome = await repository.writeIndex(index, 0);
    expect(outcome).toEqual({ status: 'written', revision: 1 });

    const read = await repository.readIndex();
    expect(read).toEqual(index);
  });

  it('round-trips a diagram record through GET/PUT /api/diagrams/<id>', async () => {
    const record = sampleRecord();
    let stored: unknown;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        stored = JSON.parse(init.body as string);
        return { ok: true, status: 200, json: async () => undefined };
      }
      return { ok: true, status: 200, json: async () => stored ?? record };
    }));
    const repository = createFileLibraryRepository('/api');

    const outcome = await repository.writeDiagram(record, 0);
    expect(outcome).toEqual({ status: 'written', revision: 1 });

    const read = await repository.readDiagram('overview');
    expect(read).toEqual(record);
  });

  it('maps a 409 conflict to stale-revision, reading the actual revision from the body', async () => {
    stubFetchOnce(409, { revision: 7 });
    const repository = createFileLibraryRepository('/api');
    const outcome = await repository.writeDiagram(sampleRecord(), 0);
    expect(outcome).toEqual({ status: 'stale-revision', actualRevision: 7 });
  });

  it('falls back to actualRevision -1 when a 409 body is missing or has no numeric revision', async () => {
    stubFetchOnce(409, undefined);
    const repository = createFileLibraryRepository('/api');
    const outcome = await repository.writeIndex(sampleIndex(), 0);
    expect(outcome).toEqual({ status: 'stale-revision', actualRevision: -1 });
  });

  it('maps a 500 response to save-failed rather than throwing', async () => {
    stubFetchOnce(500, undefined);
    const repository = createFileLibraryRepository('/api');
    const outcome = await repository.writeDiagram(sampleRecord(), 0);
    expect(outcome.status).toBe('save-failed');
  });

  it('throws CanvasLoadError when a record cannot be parsed', async () => {
    stubFetchOnce(200, { not: 'a diagram record' });
    const repository = createFileLibraryRepository('/api');
    await expect(repository.readDiagram('overview')).rejects.toBeInstanceOf(CanvasLoadError);
  });

  it('throws CanvasLoadError on a 404 from readDiagram, without special-casing it', async () => {
    stubFetchOnce(404, undefined);
    const repository = createFileLibraryRepository('/api');
    await expect(repository.readDiagram('overview')).rejects.toBeInstanceOf(CanvasLoadError);
  });

  it('throws CanvasLoadError on a 404 from readIndex too — no library bootstrap here', async () => {
    stubFetchOnce(404, undefined);
    const repository = createFileLibraryRepository('/api');
    await expect(repository.readIndex()).rejects.toBeInstanceOf(CanvasLoadError);
  });

  it('lists diagram ids from GET /api/diagrams', async () => {
    stubFetchOnce(200, ['overview', 'messaging']);
    const repository = createFileLibraryRepository('/api');
    expect(await repository.listDiagramIds()).toEqual(['overview', 'messaging']);
  });

  it('rejects a malformed diagram-id listing instead of handing back garbage', async () => {
    stubFetchOnce(200, { not: 'an array' });
    const repository = createFileLibraryRepository('/api');
    await expect(repository.listDiagramIds()).rejects.toBeInstanceOf(CanvasLoadError);
  });

  it('treats a 404 on delete as already-deleted, and surfaces any other failure', async () => {
    stubFetchOnce(404, undefined);
    const repository = createFileLibraryRepository('/api');
    await expect(repository.deleteDiagram('overview')).resolves.toBeUndefined();

    stubFetchOnce(500, undefined);
    const repository2 = createFileLibraryRepository('/api');
    await expect(repository2.deleteDiagram('overview')).rejects.toThrow();
  });
});

describe('migrated record round-trip', () => {
  const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));

  it('survives JSON round-trip and schema parse unchanged, for every migrated record', () => {
    for (const record of Object.values(migrated.records)) {
      const roundTripped = diagramRecordSchema.parse(JSON.parse(JSON.stringify(record)));
      expect(roundTripped).toEqual(record);
    }
  });
});
