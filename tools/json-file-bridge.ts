import { existsSync, watch } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { parseArchitectureDocument } from '../src/domain/schema.ts';
import { migrateDocumentToLibrary } from '../src/domain/migrate/v2-to-v3.ts';
import type { MigrationReport } from '../src/domain/records.ts';

const FILES = new Map<string, { file: string; fallback?: string }>([
  ['/api/architecture', {
    file: 'public/data/project-architecture.json',
    // The one-time library migration renames this file away; a host still speaking the legacy
    // architecture endpoint (the current rendering pipeline) must keep reading the same content
    // afterward, so a missing primary falls back to where the migration left it.
    fallback: 'public/data/project-architecture.pre-v3.json',
  }],
  ['/api/preferences', { file: 'public/data/canvas-preferences.json' }],
]);

/** Only the architecture document carries a revision worth guarding. */
const REVISION_GUARDED = new Set(['project-architecture.json']);

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Renders the bytes a served JSON file should hold on disk.
 *
 * The stored shape is this bridge's invariant, not its callers'. Every writer — the browser,
 * the canvas CLI, a curl by hand — lands the same 2-space indented, newline-terminated form,
 * so a diagram stays reviewable in a diff no matter which client last touched it. Leaving the
 * format to the sender is what let one client silently minify a 300-line record into a single
 * unreadable line.
 *
 * Canonicalising is deliberately not validating: a body this cannot parse is written through
 * unchanged, so schema enforcement stays with the schema layer and a malformed PUT still
 * fails where it already failed rather than here.
 */
function canonicalJson(raw: string): string {
  try {
    return `${JSON.stringify(JSON.parse(raw) as unknown, null, 2)}\n`;
  } catch {
    return raw.endsWith('\n') ? raw : `${raw}\n`;
  }
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  file: string,
  onWrite: () => void,
  fallback?: string,
): Promise<void> {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  const readable = !existsSync(file) && fallback && existsSync(fallback) ? fallback : file;
  if (request.method === 'GET') {
    response.end(await readFile(readable, 'utf8'));
    return;
  }
  if (request.method === 'PUT') {
    const raw = await bodyOf(request);
    const parsed = JSON.parse(raw) as { revision?: number };
    if (REVISION_GUARDED.has(basename(file)) && typeof parsed.revision === 'number' && existsSync(readable)) {
      // Compare-and-swap: an external writer (the canvas CLI) may have advanced
      // the file since this client loaded it; a stale PUT must not clobber that.
      const disk = JSON.parse(await readFile(readable, 'utf8')) as { revision?: number };
      if (typeof disk.revision === 'number' && parsed.revision <= disk.revision) {
        response.statusCode = 409;
        response.end(JSON.stringify({ error: 'stale revision', disk: disk.revision }));
        return;
      }
    }
    await writeFile(file, canonicalJson(raw), 'utf8');
    onWrite();
    response.statusCode = 204;
    response.end();
    return;
  }
  response.statusCode = 405;
  response.end(JSON.stringify({ error: 'Method not allowed' }));
}

/** What a revisioned file write produced: written, or the actual revision it conflicted with. */
export type RecordWriteOutcome = { status: 'written' } | { status: 'conflict'; revision: number };

/**
 * Compare-and-swap write for one record file, independent of HTTP plumbing.
 *
 * A file that does not exist yet reads as revision 0, so a create (`expectedRevision: 0`)
 * against a never-written record succeeds — matching what `createCanvasLibrary` sends when it
 * writes a brand-new diagram.
 */
export async function writeRecordFile(
  file: string,
  raw: string,
  expectedRevision: number,
): Promise<RecordWriteOutcome> {
  const diskRevision = existsSync(file)
    ? (JSON.parse(await readFile(file, 'utf8')) as { revision?: number }).revision ?? 0
    : 0;
  if (expectedRevision !== diskRevision) return { status: 'conflict', revision: diskRevision };
  await writeFile(file, canonicalJson(raw), 'utf8');
  return { status: 'written' };
}

/** Result of checking whether the one-time legacy-to-library migration ran. */
export type BootstrapOutcome = { migrated: false } | { migrated: true; report: MigrationReport };

/**
 * Runs the legacy-document-to-library migration exactly once per data directory.
 *
 * Idempotent by construction rather than by a lock: the presence of `library.json` is the only
 * signal consulted, and the migration's own last step renames the legacy file away, so a second
 * call finds nothing left to migrate and returns immediately.
 */
export async function bootstrapLibrary(dataDir: string): Promise<BootstrapOutcome> {
  const libraryPath = join(dataDir, 'library.json');
  const legacyPath = join(dataDir, 'project-architecture.json');
  if (existsSync(libraryPath) || !existsSync(legacyPath)) return { migrated: false };
  const document = parseArchitectureDocument(JSON.parse(await readFile(legacyPath, 'utf8')));
  const { index, records, report } = migrateDocumentToLibrary(document);
  const diagramsDir = join(dataDir, 'diagrams');
  await mkdir(diagramsDir, { recursive: true });
  await Promise.all(Object.values(records).map((record) =>
    writeFile(join(diagramsDir, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8')));
  await writeFile(libraryPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await rename(legacyPath, join(dataDir, 'project-architecture.pre-v3.json'));
  return { migrated: true, report };
}

function logMigration(report: MigrationReport): void {
  console.log(
    `[canvas migration] diagramsCreated=${report.diagramsCreated} `
    + `unfiledNodes=${report.unfiledNodeIds.length} `
    + `crossDiagramLinks=${report.crossDiagramLinkIds.length} `
    + `carriedOperations=${report.carriedOperationIds.length}`,
  );
}

function expectedRevisionOf(url: URL): number | undefined {
  const raw = url.searchParams.get('expectedRevision');
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function handleRecordFile(
  request: IncomingMessage,
  response: ServerResponse,
  file: string,
  expectedRevision: number | undefined,
  onWrite: () => void,
): Promise<void> {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  if (request.method === 'GET') {
    if (!existsSync(file)) {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    response.end(await readFile(file, 'utf8'));
    return;
  }
  if (request.method === 'PUT') {
    const raw = await bodyOf(request);
    const outcome = await writeRecordFile(file, raw, expectedRevision ?? 0);
    if (outcome.status === 'conflict') {
      response.statusCode = 409;
      response.end(JSON.stringify({ revision: outcome.revision }));
      return;
    }
    onWrite();
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method === 'DELETE') {
    // Idempotent by design: `createFileLibraryRepository` treats a 404 as "already gone", so
    // removing a record twice is not an error the host has to distinguish.
    onWrite();
    await rm(file, { force: true });
    response.statusCode = 204;
    response.end();
    return;
  }
  response.statusCode = 405;
  response.end(JSON.stringify({ error: 'Method not allowed' }));
}

async function handleLibrary(
  request: IncomingMessage,
  response: ServerResponse,
  dataDir: string,
  expectedRevision: number | undefined,
  onWrite: () => void,
): Promise<void> {
  if (request.method === 'GET') {
    // Mark the write window before the migration's own file writes, not after: they land as a
    // burst of `fs.watch` events, and the whole burst must be suppressed as self-inflicted, not
    // just whichever event happens to land after the last `await`. Only marked when a migration
    // is actually about to run, so an ordinary GET never masks a genuine concurrent external write.
    const aboutToMigrate = !existsSync(join(dataDir, 'library.json'))
      && existsSync(join(dataDir, 'project-architecture.json'));
    if (aboutToMigrate) onWrite();
    const outcome = await bootstrapLibrary(dataDir);
    if (outcome.migrated) logMigration(outcome.report);
  }
  await handleRecordFile(request, response, join(dataDir, 'library.json'), expectedRevision, onWrite);
}

async function handleDiagramsList(request: IncomingMessage, response: ServerResponse, dataDir: string): Promise<void> {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const diagramsDir = join(dataDir, 'diagrams');
  const ids = existsSync(diagramsDir)
    ? (await readdir(diagramsDir)).filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length)).sort()
    : [];
  response.end(JSON.stringify(ids));
}

/** Stops watching a data directory and forgets any change still waiting to be announced. */
export interface DataDirectoryWatch {
  /** Marks the moment this process wrote a served file, so its own writes do not echo back. */
  markOwnWrite(): void;
  close(): void;
}

/** How long a write is attributed to this process, and how long changes are coalesced. */
const OWN_WRITE_WINDOW_MS = 500;
const CHANGE_DEBOUNCE_MS = 200;

/**
 * Watches a data directory and everything under it for writes this process did not make.
 *
 * Recursive is the whole point: records live in `diagrams/`, one file each, and the CLI writes
 * them straight to disk. A watch on the top directory alone sees the legacy document and the
 * preferences change but never a record, so an open app would silently keep showing a diagram
 * the CLI had already rewritten.
 */
export function watchDataDirectory(dataDir: string, onExternalChange: (fileName: string) => void): DataDirectoryWatch {
  let lastOwnWrite = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const watcher = watch(dataDir, { recursive: true }, (_event, fileName) => {
    if (!fileName || !fileName.endsWith('.json')) return;
    if (Date.now() - lastOwnWrite < OWN_WRITE_WINDOW_MS) return;
    clearTimeout(pending);
    pending = setTimeout(() => onExternalChange(fileName), CHANGE_DEBOUNCE_MS);
  });
  return {
    markOwnWrite: () => { lastOwnWrite = Date.now(); },
    close() {
      clearTimeout(pending);
      watcher.close();
    },
  };
}

/** Development-only bridge serving the legacy document, preferences, and the v3 record library. */
export function jsonFileBridge(): Plugin {
  return {
    name: 'novakai-canvas-json-file-bridge',
    configureServer(server) {
      const dataDir = resolve('public/data');
      server.watcher.unwatch(dataDir);

      // Notify the open app when someone ELSE (the canvas CLI, an editor) writes
      // the data files. Bridge PUTs mark themselves so autosave does not echo.
      const watcher = watchDataDirectory(dataDir, (fileName) => {
        server.ws.send({ type: 'custom', event: 'novakai:data-changed', data: { path: fileName } });
      });
      const markBridgeWrite = watcher.markOwnWrite;
      server.httpServer?.once('close', () => watcher.close());

      server.middlewares.use((request, response, next) => {
        if (!request.url) return next();
        const url = new URL(request.url, 'http://localhost');
        const path = url.pathname;
        const fail = (error: unknown): void => {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        };

        if (path === '/api/library') {
          void handleLibrary(request, response, dataDir, expectedRevisionOf(url), markBridgeWrite).catch(fail);
          return;
        }
        if (path === '/api/diagrams') {
          void handleDiagramsList(request, response, dataDir).catch(fail);
          return;
        }
        if (path.startsWith('/api/diagrams/')) {
          const id = decodeURIComponent(path.slice('/api/diagrams/'.length));
          if (id && !id.includes('/')) {
            const file = join(dataDir, 'diagrams', `${id}.json`);
            void handleRecordFile(request, response, file, expectedRevisionOf(url), markBridgeWrite).catch(fail);
            return;
          }
        }
        const known = FILES.get(path);
        if (!known) return next();
        void handle(request, response, resolve(known.file), markBridgeWrite, known.fallback && resolve(known.fallback))
          .catch(fail);
      });
    },
  };
}
