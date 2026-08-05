import { describe, expect, it, vi } from 'vitest';
import {
  createCanvasEngine, createCanvasObjectStoreRepository,
  type CanvasDocumentRecord, type CanvasObjectStore,
} from '../canvas.ts';
import { emptyArchitecture } from '../domain/defaults';

function memoryStore(): CanvasObjectStore & { records: Map<string, CanvasDocumentRecord> } {
  const records = new Map<string, CanvasDocumentRecord>();
  return {
    records,
    async read(key) { return records.get(key); },
    async compareAndSet(key, expectedRevision, record) {
      const current = records.get(key);
      if (current?.revision !== expectedRevision) return false;
      records.set(key, structuredClone(record));
      return true;
    },
  };
}

describe('Canvas object-store host adapter', () => {
  it('lets a second host load, observe, edit, and save through the public capability', async () => {
    const store = memoryStore();
    const firstRepository = createCanvasObjectStoreRepository(store, 'architecture', structuredClone(emptyArchitecture));
    const first = createCanvasEngine(await firstRepository.load(), firstRepository);
    first.submit({
      operationId: 'first-host-create', expectedRevision: 0,
      actor: { id: 'standalone-host', kind: 'system' },
      timestamp: '2026-08-05T12:00:00.000Z', provenance: { source: 'system' },
      commands: [{
        kind: 'diagram.create',
        diagram: { id: 'overview', rootNodeId: 'overview-root', status: 'active', sourceRefs: [] },
        root: { id: 'overview-root', kind: 'scope', label: 'Overview', interfaceIds: [], typeIds: [] },
        placement: { nodeId: 'overview-root', position: { x: 0, y: 0 }, size: { width: 800, height: 500 }, pinned: false },
      }],
    });
    await first.save();

    const novakaiRepository = createCanvasObjectStoreRepository(store, 'architecture', structuredClone(emptyArchitecture));
    const novakaiHost = createCanvasEngine(await novakaiRepository.load(), novakaiRepository);
    const observer = vi.fn();
    novakaiHost.subscribe(observer);
    expect(novakaiHost.snapshot().diagrams.overview).toBeDefined();
    expect(novakaiHost.submit({
      operationId: 'novakai-host-edit', expectedRevision: 1,
      actor: { id: 'novakai-projects', kind: 'system' },
      timestamp: '2026-08-05T12:01:00.000Z',
      provenance: { source: 'system', sourceRef: 'project:novakai-canvas' },
      commands: [{
        kind: 'diagram.setReferences', id: 'overview',
        subjectRef: { namespace: 'novakai-project', id: 'novakai-canvas' },
        sourceRefs: [{ namespace: 'novakai-code', id: 'repo:novakai-canvas' }],
      }],
    }).status).toBe('applied');
    expect(observer).toHaveBeenCalledOnce();
    await novakaiHost.save();

    expect(store.records.get('canvas.document:architecture')?.value.diagrams.overview).toMatchObject({
      subjectRef: { namespace: 'novakai-project', id: 'novakai-canvas' },
      sourceRefs: [{ namespace: 'novakai-code', id: 'repo:novakai-canvas' }],
    });
  });

  it('refuses to overwrite a newer host revision', async () => {
    const store = memoryStore();
    const repositoryA = createCanvasObjectStoreRepository(store, 'architecture', structuredClone(emptyArchitecture));
    const repositoryB = createCanvasObjectStoreRepository(store, 'architecture', structuredClone(emptyArchitecture));
    const hostA = createCanvasEngine(await repositoryA.load(), repositoryA);
    const hostB = createCanvasEngine(await repositoryB.load(), repositoryB);
    hostA.execute({
      kind: 'diagram.create',
      diagram: { id: 'a', rootNodeId: 'a-root', status: 'active', sourceRefs: [] },
      root: { id: 'a-root', kind: 'scope', label: 'A', interfaceIds: [], typeIds: [] },
      placement: { nodeId: 'a-root', position: { x: 0, y: 0 }, size: { width: 500, height: 300 }, pinned: false },
    });
    await hostA.save();
    hostB.execute({
      kind: 'diagram.create',
      diagram: { id: 'b', rootNodeId: 'b-root', status: 'active', sourceRefs: [] },
      root: { id: 'b-root', kind: 'scope', label: 'B', interfaceIds: [], typeIds: [] },
      placement: { nodeId: 'b-root', position: { x: 0, y: 0 }, size: { width: 500, height: 300 }, pinned: false },
    });
    await expect(hostB.save()).rejects.toThrow('stale-revision');
  });
});
