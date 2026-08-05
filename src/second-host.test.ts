import { describe, expect, it } from 'vitest';
import {
  censusOfMigratedLibrary, createCanvasLibrary, createMemoryLibraryRepository,
  migrateDocumentToLibrary,
} from './canvas';
import type { ActorContext, CanvasWorkspace, DiagramRecord } from './canvas';
import { parseArchitectureDocument } from './domain/schema';
import working from './domain/migrate/fixtures/real-v2-working-copy.json' with { type: 'json' };

/**
 * A deliberately different host.
 *
 * No React, no React Flow, no DOM, no dev server, no `public/data` — a content-addressed store
 * held in a plain Map, driven from a Node process. If Canvas can only be used by the app it
 * was written for, it is not a capability; it is just that app's insides.
 */
function contentAddressedHost() {
  const blobs = new Map<string, string>();
  const digest = (id: string): string => `sha-${id}`;

  return {
    blobs,
    write(id: string, value: unknown): void {
      blobs.set(digest(id), JSON.stringify(value));
    },
    read<T>(id: string): T {
      const stored = blobs.get(digest(id));
      if (!stored) throw new Error(`no-object:${id}`);
      return JSON.parse(stored) as T;
    },
  };
}

const agent: ActorContext = {
  actor: { id: 'second-host', kind: 'agent' },
  provenance: { source: 'agent' },
};

describe('second host', () => {
  it('loads, observes, edits and saves without one line of Canvas core', async () => {
    const store = contentAddressedHost();
    const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));

    // The host owns storage entirely: it decides addressing, encoding, and durability.
    for (const [id, record] of Object.entries(migrated.records)) store.write(id, record);
    store.write('index', migrated.index);

    const repository = createMemoryLibraryRepository({
      index: store.read('index'),
      records: Object.fromEntries(Object.keys(migrated.records)
        .map((id) => [id, store.read<DiagramRecord>(id)])),
    });
    const library = createCanvasLibrary(repository, store.read('index'), agent);

    // Observe.
    expect(library.search('message router').map((entry) => entry.id)).toContain('messaging-scope');

    // Edit.
    const opened = await library.open('messaging-scope');
    const workspace = opened as CanvasWorkspace;
    const before = workspace.snapshot().revision;
    const outcome = workspace.execute({ kind: 'diagram.rename', name: 'Messaging (second host)' });
    expect(outcome).toMatchObject({ status: 'applied', revision: before + 1 });

    // Save.
    expect(await library.save('messaging-scope')).toMatchObject({ status: 'written' });
    expect(library.list().find((entry) => entry.id === 'messaging-scope')?.name)
      .toBe('Messaging (second host)');

    // Nothing was lost in the round trip.
    const census = censusOfMigratedLibrary(migrated);
    expect(census.nodeSignatures.length).toBe(259);
  });

  it('keeps the public surface free of framework and storage types', () => {
    const surface = Object.values(
      import.meta.glob('./canvas.ts', { query: '?raw', import: 'default', eager: true }),
    )[0] as string;

    for (const forbidden of ['react', 'React', '@xyflow', 'node:fs', 'fetch(']) {
      expect(surface).not.toContain(forbidden);
    }
  });

  it('keeps the domain and application layers free of hosts, frameworks and I/O', () => {
    // An architecture test, not a style rule: the moment the core can reach a framework or the
    // filesystem, the second host above stops being possible and nobody notices until it is.
    const sources = import.meta.glob(
      ['./domain/**/*.ts', './application/**/*.ts'],
      { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;

    const offenders = Object.entries(sources)
      .filter(([path]) => !path.includes('.test.'))
      .filter(([, source]) => /from '(react|react-dom|@xyflow\/react|node:fs|node:path)'/.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
