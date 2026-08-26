import { beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { DiagramRecord, LibraryIndex } from '@novakai/canvas';

const CLI = resolve(import.meta.dirname, '../../cli/canvas.ts');
const REAL_DATA = resolve(import.meta.dirname, '../../../../public/data');

export interface RunResult { code: number; stdout: string; stderr: string }

export function runCli(args: string[], input?: string): Promise<RunResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', rejectPromise);
    child.on('close', (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

export const DEMO = `
scope "CLI Demo"
  note "Authored by the integration test."
  module "Demo broker" "Hands out demo sessions"
    acquire(AgentId) -> DemoHandle
    type DemoHandle { id, endpoint }
  module "Demo client"
  timeline "Demo history"
    step "turn 1"
  wire "Demo client" -> "Demo broker" : acquire(AgentId) -> DemoHandle [queries]
`;

export let dataDir: string;

export async function readRecord(id: string): Promise<DiagramRecord> {
  return JSON.parse(await readFile(join(dataDir, 'diagrams', `${id}.json`), 'utf8')) as DiagramRecord;
}

export async function readIndex(): Promise<LibraryIndex> {
  return JSON.parse(await readFile(join(dataDir, 'library.json'), 'utf8')) as LibraryIndex;
}

export function placementsOf(record: DiagramRecord) {
  return record.layouts[record.views[record.activeViewId].layoutId].placements;
}

export async function dataHashes(): Promise<Record<string, string>> {
  const files = [
    'library.json',
    'canvas-preferences.json',
    ...(await readdir(join(dataDir, 'diagrams'))).sort().map((name) => `diagrams/${name}`),
  ];
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file,
    createHash('sha256').update(await readFile(join(dataDir, file))).digest('hex'),
  ])));
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'canvas-cli-'));
  await cp(join(REAL_DATA, 'library.json'), join(dataDir, 'library.json'));
  await cp(join(REAL_DATA, 'canvas-preferences.json'), join(dataDir, 'canvas-preferences.json'));
  await cp(join(REAL_DATA, 'diagrams'), join(dataDir, 'diagrams'), { recursive: true });
});


export { existsSync, readFile, writeFile, join };
