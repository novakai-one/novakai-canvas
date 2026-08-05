/** File-per-diagram storage for the CLI: the record library as it sits in `public/data`. */

import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createCanvasLibrary } from '../../src/canvas.ts';
import type {
  CanvasLibrary, CanvasLibraryRepository, DiagramRecord, LibraryIndex, WriteOutcome,
} from '../../src/canvas.ts';
import { diagramRecordSchema, libraryIndexSchema } from '../../src/canvas.ts';
import { bootstrapLibrary } from '../json-file-bridge.ts';

const INDEX_FILE = 'library.json';
const DIAGRAMS_DIR = 'diagrams';

/** An empty index, used when a data directory holds no library and no legacy document yet. */
const EMPTY_INDEX: LibraryIndex = {
  schemaVersion: 3,
  revision: 0,
  entries: {},
  links: {},
  migratedOperations: {},
};

function indexPath(dataDir: string): string {
  return join(dataDir, INDEX_FILE);
}

function diagramPath(dataDir: string, id: string): string {
  return join(dataDir, DIAGRAMS_DIR, `${id}.json`);
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

/**
 * Writes one JSON file atomically, refusing a write made against a stale revision.
 *
 * Temp-file-and-rename rather than a plain write: a `./canvas apply` interrupted mid-write would
 * otherwise leave a truncated record behind, and an unreadable record is a diagram lost.
 */
async function writeRevisioned(
  file: string,
  value: { revision: number },
  expectedRevision: number,
): Promise<WriteOutcome> {
  const diskRevision = existsSync(file)
    ? ((await readJson(file)) as { revision?: number }).revision ?? 0
    : 0;
  if (diskRevision !== expectedRevision) {
    return { status: 'stale-revision', actualRevision: diskRevision };
  }
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, file);
  return { status: 'written', revision: value.revision };
}

/**
 * A repository over a data directory: `library.json` plus one file per record in `diagrams/`.
 *
 * The same layout the dev bridge serves over HTTP, reached directly. The CLI is a Node process
 * on the same machine as the files, so going through a server it would first have to start
 * would add a failure mode and buy nothing.
 */
export function createDirectoryLibraryRepository(dataDir: string): CanvasLibraryRepository {
  return {
    async readIndex() {
      const file = indexPath(dataDir);
      if (!existsSync(file)) return structuredClone(EMPTY_INDEX);
      return libraryIndexSchema.parse(await readJson(file));
    },

    writeIndex: (index, expectedRevision) =>
      writeRevisioned(indexPath(dataDir), libraryIndexSchema.parse(index), expectedRevision),

    async readDiagram(id) {
      const file = diagramPath(dataDir, id);
      if (!existsSync(file)) throw new Error(`no diagram record at ${file}`);
      return diagramRecordSchema.parse(await readJson(file));
    },

    writeDiagram: (record, expectedRevision) =>
      writeRevisioned(diagramPath(dataDir, record.id), diagramRecordSchema.parse(record), expectedRevision),

    async deleteDiagram(id) {
      await rm(diagramPath(dataDir, id), { force: true });
    },

    async listDiagramIds() {
      const dir = join(dataDir, DIAGRAMS_DIR);
      if (!existsSync(dir)) return [];
      return (await readdir(dir))
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.slice(0, -'.json'.length))
        .sort();
    },
  };
}

/**
 * Resolves the `--file` argument to the data directory that holds the library.
 *
 * The flag predates records, when it named one architecture JSON file. Pointing it at a file
 * still works and means "the directory that file lives in", so every invocation and script
 * written against the old surface keeps running against the migrated data.
 */
export function dataDirectoryOf(pathArgument: string): string {
  if (existsSync(pathArgument) && statSync(pathArgument).isDirectory()) return pathArgument;
  return pathArgument.endsWith('.json') ? dirname(pathArgument) : pathArgument;
}

/** An opened library and the repository under it, which the CLI needs for whole-record writes. */
export interface OpenedLibrary {
  repository: CanvasLibraryRepository;
  library: CanvasLibrary;
  dataDir: string;
}

/**
 * Opens the library in a data directory, migrating a legacy document first if one is still there.
 *
 * The bootstrap is the same one the dev bridge runs, deliberately: whichever host touches the
 * data first performs the migration, and the other finds it already done.
 */
export async function openLibrary(dataDir: string, sourceRef: string): Promise<OpenedLibrary> {
  await bootstrapLibrary(dataDir);
  const repository = createDirectoryLibraryRepository(dataDir);
  const index = await repository.readIndex();
  const library = createCanvasLibrary(repository, index, {
    actor: { id: 'canvas-cli', kind: 'system' },
    provenance: { source: 'cli', sourceRef },
  });
  return { repository, library, dataDir };
}

/** Reads every record the index knows about, keyed by diagram id. */
export async function readAllRecords(
  repository: CanvasLibraryRepository,
  library: CanvasLibrary,
): Promise<Record<string, DiagramRecord>> {
  const summaries = library.list({ includeArchived: true });
  const records = await Promise.all(summaries.map((summary) => repository.readDiagram(summary.id)));
  return Object.fromEntries(records.map((record) => [record.id, record]));
}
