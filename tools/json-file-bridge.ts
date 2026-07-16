import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const FILES = new Map([
  ['/api/architecture', 'public/data/project-architecture.json'],
  ['/api/preferences', 'public/data/canvas-preferences.json'],
]);

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function handle(request: IncomingMessage, response: ServerResponse, file: string): Promise<void> {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  if (request.method === 'GET') {
    response.end(await readFile(file, 'utf8'));
    return;
  }
  if (request.method === 'PUT') {
    const raw = await bodyOf(request);
    JSON.parse(raw);
    await writeFile(file, raw.endsWith('\n') ? raw : `${raw}\n`, 'utf8');
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
      server.watcher.unwatch(resolve('public/data'));
      server.middlewares.use((request, response, next) => {
        const path = request.url ? new URL(request.url, 'http://localhost').pathname : '';
        const relative = FILES.get(path);
        if (!relative) return next();
        void handle(request, response, resolve(relative)).catch((error: unknown) => {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        });
      });
    },
  };
}
