import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapLibrary, watchDataDirectory, writeRecordFile } from './json-file-bridge.ts';

/** The smallest legacy document that produces one migrated diagram. */
const MINIMAL_LEGACY_DOCUMENT = {
  schemaVersion: 2,
  id: 'doc',
  name: 'Minimal',
  revision: 3,
  nodes: {
    root: { id: 'root', kind: 'scope', label: 'Root Diagram', interfaceIds: [], typeIds: [] },
    child: {
      id: 'child', kind: 'module', label: 'Child', parentId: 'root', interfaceIds: [], typeIds: [],
    },
  },
  interfaces: {},
  types: {},
  wires: {},
  activeLayoutId: 'layout-default',
  layouts: {
    'layout-default': {
      id: 'layout-default', name: 'Default', strategy: 'manual', placements: {}, wireRouteHints: {}, collapsedNodeIds: [],
    },
  },
  diagrams: {},
  appliedOperations: {},
};

async function tempDataDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canvas-bridge-'));
  await writeFile(join(dir, 'project-architecture.json'), `${JSON.stringify(MINIMAL_LEGACY_DOCUMENT, null, 2)}\n`, 'utf8');
  return dir;
}

describe('bootstrapLibrary', () => {
  it('migrates a legacy document into a library and per-diagram records exactly once', async () => {
    const dir = await tempDataDir();

    const first = await bootstrapLibrary(dir);
    expect(first.migrated).toBe(true);
    if (!first.migrated) throw new Error('unreachable');
    expect(first.report.diagramsCreated).toBe(1);

    expect(existsSync(join(dir, 'library.json'))).toBe(true);
    expect(existsSync(join(dir, 'diagrams', 'root.json'))).toBe(true);
    expect(existsSync(join(dir, 'project-architecture.json'))).toBe(false);
    expect(existsSync(join(dir, 'project-architecture.pre-v3.json'))).toBe(true);

    const libraryAfterFirst = await readFile(join(dir, 'library.json'), 'utf8');
    const diagramIdsAfterFirst = await readdir(join(dir, 'diagrams'));

    // A second call (a second page load, a second host) must find nothing left to migrate.
    const second = await bootstrapLibrary(dir);
    expect(second.migrated).toBe(false);
    expect(await readFile(join(dir, 'library.json'), 'utf8')).toBe(libraryAfterFirst);
    expect(await readdir(join(dir, 'diagrams'))).toEqual(diagramIdsAfterFirst);
  });

  it('does nothing when there is no legacy document to migrate', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'canvas-bridge-empty-'));
    const outcome = await bootstrapLibrary(dir);
    expect(outcome).toEqual({ migrated: false });
    expect(existsSync(join(dir, 'library.json'))).toBe(false);
  });
});

describe('writeRecordFile', () => {
  it('returns 409-worthy conflict with the actual revision on a stale expected revision', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'canvas-bridge-cas-'));
    const file = join(dir, 'diagrams', 'demo.json');
    await mkdir(join(dir, 'diagrams'), { recursive: true });
    await writeFile(file, `${JSON.stringify({ id: 'demo', revision: 5 })}\n`, 'utf8');

    const stale = await writeRecordFile(file, JSON.stringify({ id: 'demo', revision: 6 }), 4);
    expect(stale).toEqual({ status: 'conflict', revision: 5 });
    // A rejected write must not touch the file.
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ revision: 5 });

    const matching = await writeRecordFile(file, JSON.stringify({ id: 'demo', revision: 6 }), 5);
    expect(matching).toEqual({ status: 'written' });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ revision: 6 });
  });

  it('accepts a create (expectedRevision 0) against a file that does not exist yet', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'canvas-bridge-create-'));
    const file = join(dir, 'diagrams', 'new.json');
    await mkdir(join(dir, 'diagrams'), { recursive: true });
    const outcome = await writeRecordFile(file, JSON.stringify({ id: 'new', revision: 0 }), 0);
    expect(outcome).toEqual({ status: 'written' });
  });
});

/** Waits for a condition the filesystem watcher fulfils asynchronously, or gives up loudly. */
async function eventually(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((settle) => { setTimeout(settle, 25); });
  }
  throw new Error('condition was never met');
}

describe('watchDataDirectory', () => {
  it('reports a record written into the diagrams subdirectory by something else', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'canvas-bridge-watch-'));
    await mkdir(join(dir, 'diagrams'), { recursive: true });
    const seen: string[] = [];
    const watcher = watchDataDirectory(dir, (fileName) => seen.push(fileName));
    try {
      // The canvas CLI writes exactly like this: straight to the record file, never through
      // the bridge. A non-recursive watch never sees it.
      await writeFile(join(dir, 'diagrams', 'cli-written.json'), '{"id":"cli-written"}\n', 'utf8');
      await eventually(() => seen.length > 0);
      expect(seen.some((name) => name.endsWith('cli-written.json'))).toBe(true);
    } finally {
      watcher.close();
    }
  });

  it('stays silent for a record this process wrote itself', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'canvas-bridge-selfwrite-'));
    await mkdir(join(dir, 'diagrams'), { recursive: true });
    const seen: string[] = [];
    const watcher = watchDataDirectory(dir, (fileName) => seen.push(fileName));
    try {
      watcher.markOwnWrite();
      await writeFile(join(dir, 'diagrams', 'own.json'), '{"id":"own"}\n', 'utf8');
      await new Promise((settle) => { setTimeout(settle, 400); });
      expect(seen).toEqual([]);
    } finally {
      watcher.close();
    }
  });
});
