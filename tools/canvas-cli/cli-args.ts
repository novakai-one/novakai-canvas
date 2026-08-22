/** CLI argument, input and map-name adapters. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CanvasLibrary } from '../../src/canvas.ts';
import { dataDirectoryOf } from './library-io.ts';
import { slugify } from './slug.ts';

const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../public/data', import.meta.url));

export interface CliArgs {
  verb: string;
  positional: string[];
  dataDir: string;
  out?: string;
  operationId?: string;
}

/** Parses process arguments without executing a verb. */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { verb: argv[0] ?? 'help', positional: [], dataDir: DEFAULT_DATA_DIR };
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--file' || argv[index] === '--data') args.dataDir = dataDirectoryOf(argv[(index += 1)]);
    else if (argv[index] === '-o' || argv[index] === '--out') args.out = argv[(index += 1)];
    else if (argv[index] === '--operation-id') args.operationId = argv[(index += 1)];
    else args.positional.push(argv[index]);
  }
  return args;
}

export function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Resolves a map by id, name, then slug. */
export function diagramIdOrFail(library: CanvasLibrary, query: string): string {
  const summaries = library.list({ includeArchived: true });
  const querySlug = slugify(query);
  const match = summaries.find((summary) => summary.id === query)
    ?? summaries.find((summary) => slugify(summary.name) === querySlug)
    ?? summaries.find((summary) => slugify(summary.id) === querySlug);
  if (!match) fail(`no map "${query}" — available: ${summaries.map((summary) => summary.id).join(', ')}`);
  return match.id as string;
}

export function readStdinOr(path: string | undefined, hint: string): string {
  if (path) return readFileSync(path, 'utf8');
  if (process.stdin.isTTY) fail(hint);
  return readFileSync(0, 'utf8');
}
