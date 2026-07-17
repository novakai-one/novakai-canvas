import { watch } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const FILES = new Map([
  ['/api/architecture', 'public/data/project-architecture.json'],
  ['/api/preferences', 'public/data/canvas-preferences.json'],
]);

/** Only the architecture document carries a revision worth guarding. */
const REVISION_GUARDED = new Set(['project-architecture.json']);

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  file: string,
  onWrite: () => void,
): Promise<void> {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  if (request.method === 'GET') {
    response.end(await readFile(file, 'utf8'));
    return;
  }
  if (request.method === 'PUT') {
    const raw = await bodyOf(request);
    const parsed = JSON.parse(raw) as { revision?: number };
    if (REVISION_GUARDED.has(basename(file)) && typeof parsed.revision === 'number') {
      // Compare-and-swap: an external writer (the canvas CLI) may have advanced
      // the file since this client loaded it; a stale PUT must not clobber that.
      const disk = JSON.parse(await readFile(file, 'utf8')) as { revision?: number };
      if (typeof disk.revision === 'number' && parsed.revision <= disk.revision) {
        response.statusCode = 409;
        response.end(JSON.stringify({ error: 'stale revision', disk: disk.revision }));
        return;
      }
    }
    await writeFile(file, raw.endsWith('\n') ? raw : `${raw}\n`, 'utf8');
    onWrite();
    response.statusCode = 204;
    response.end();
    return;
  }
  response.statusCode = 405;
  response.end(JSON.stringify({ error: 'Method not allowed' }));
}

/** Development-only bridge restricted to two known JSON files. */
export function jsonFileBridge(): Plugin {
  return {
    name: 'novakai-canvas-json-file-bridge',
    configureServer(server) {
      const dataDir = resolve('public/data');
      server.watcher.unwatch(dataDir);

      // Notify the open app when someone ELSE (the canvas CLI, an editor) writes
      // the data files. Bridge PUTs mark themselves so autosave does not echo.
      let lastBridgeWrite = 0;
      const markBridgeWrite = (): void => { lastBridgeWrite = Date.now(); };
      let pending: ReturnType<typeof setTimeout> | undefined;
      const watcher = watch(dataDir, (_event, fileName) => {
        if (!fileName || !fileName.endsWith('.json')) return;
        if (Date.now() - lastBridgeWrite < 500) return;
        clearTimeout(pending);
        pending = setTimeout(() => {
          server.ws.send({ type: 'custom', event: 'novakai:data-changed', data: { path: fileName } });
        }, 200);
      });
      server.httpServer?.once('close', () => watcher.close());

      server.middlewares.use((request, response, next) => {
        const path = request.url ? new URL(request.url, 'http://localhost').pathname : '';
        const relative = FILES.get(path);
        if (!relative) return next();
        void handle(request, response, resolve(relative), markBridgeWrite).catch((error: unknown) => {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        });
      });
    },
  };
}
