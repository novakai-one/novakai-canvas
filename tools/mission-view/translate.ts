/** Reads real .novakai stores + agent registry and emits mission maps as canvas DSL.
 *
 * Usage: node tools/mission-view/translate.ts [--root <Novakai-Command checkout>] | ./canvas apply
 * Read-only over the stores; never writes anything itself.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storesToDsl, type MailMessage, type RegistryAgent, type StoreBlock } from './stores-to-dsl.ts';

const DEFAULT_ROOT = fileURLToPath(new URL('../../../Novakai-Command', import.meta.url));

function jsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const records: T[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as T);
    } catch {
      process.stderr.write(`warning: skipped malformed line in ${path}\n`);
    }
  }
  return records;
}

/** The registry has shipped as both a record and an array; accept either. */
function normalizeRegistry(path: string): RegistryAgent[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as
    RegistryAgent[] | Record<string, RegistryAgent>;
  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag !== -1 && process.argv[rootFlag + 1]
  ? resolve(process.argv[rootFlag + 1])
  : DEFAULT_ROOT;

if (!existsSync(resolve(root, '.novakai/stores'))) {
  process.stderr.write(`no .novakai/stores under ${root} — pass --root <Novakai-Command checkout>\n`);
  process.exit(1);
}

const stores = {
  projects: jsonl<StoreBlock>(resolve(root, '.novakai/stores/projects.jsonl')),
  missions: jsonl<StoreBlock>(resolve(root, '.novakai/stores/missions.jsonl')),
  tasks: jsonl<StoreBlock>(resolve(root, '.novakai/stores/tasks.jsonl')),
  okrs: jsonl<StoreBlock>(resolve(root, '.novakai/stores/okrs.jsonl')),
  agents: normalizeRegistry(resolve(root, '.novakai-command/agents.json')),
  messages: jsonl<MailMessage>(resolve(root, '.novakai-command/messages.jsonl')),
  now: new Date().toISOString(),
};

process.stdout.write(storesToDsl(stores));
