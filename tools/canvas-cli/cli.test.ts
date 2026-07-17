import { beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { architectureDocumentSchema } from '../../src/domain/schema';

const CLI = resolve(import.meta.dirname, 'cli.ts');
const REAL_DATA = resolve(import.meta.dirname, '../../public/data/project-architecture.json');

interface RunResult { code: number; stdout: string; stderr: string }

function runCli(args: string[], input?: string): Promise<RunResult> {
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

const DEMO = `
scope "CLI Demo"
  note "Authored by the integration test."
  module "Demo broker" "Hands out demo sessions"
    acquire(AgentId) -> DemoHandle
    type DemoHandle { id, endpoint }
  module "Demo client"
  wire "Demo client" -> "Demo broker" : acquire(AgentId) -> DemoHandle [queries]
`;

let dataFile: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'canvas-cli-'));
  dataFile = join(dir, 'project-architecture.json');
  await copyFile(REAL_DATA, dataFile);
});

describe('canvas CLI', () => {
  it('maps lists the three real scopes', async () => {
    const { code, stdout } = await runCli(['maps', '--file', dataFile]);
    expect(code).toBe(0);
    expect(stdout).toContain('project-scope');
    expect(stdout).toContain('messaging-scope');
    expect(stdout).toContain('browser-scope');
  });

  it('apply from stdin adds a valid scope and bumps revision', async () => {
    const before = architectureDocumentSchema.parse(JSON.parse(await readFile(dataFile, 'utf8')));
    const { code, stdout } = await runCli(['apply', '--file', dataFile], DEMO);
    expect(code, stdout).toBe(0);
    expect(stdout).toContain('applied: CLI Demo');
    const after = architectureDocumentSchema.parse(JSON.parse(await readFile(dataFile, 'utf8')));
    expect(after.revision).toBe(before.revision + 1);
    expect(after.nodes['cli-demo']).toBeDefined();
    expect(after.nodes['cli-demo--demo-broker'].parentId).toBe('cli-demo');
  });

  it('read prints the applied scope as DSL', async () => {
    await runCli(['apply', '--file', dataFile], DEMO);
    const { code, stdout } = await runCli(['read', 'cli-demo', '--file', dataFile]);
    expect(code).toBe(0);
    expect(stdout).toContain('acquire(AgentId) -> DemoHandle');
    expect(stdout).toContain('wire "Demo client" -> "Demo broker" : acquire(AgentId) -> DemoHandle [queries]');
  });

  it('rejects broken DSL with every error and leaves the file untouched', async () => {
    const before = await readFile(dataFile, 'utf8');
    const broken = 'scope Demo\n  wire A -> B\n  banana "Split"\n';
    const { code, stderr } = await runCli(['apply', '--file', dataFile], broken);
    expect(code).toBe(1);
    expect(stderr).toContain('needs a contract');
    expect(stderr).toContain('banana');
    expect(await readFile(dataFile, 'utf8')).toBe(before);
  });

  it('rm removes a scope with its wires', async () => {
    await runCli(['apply', '--file', dataFile], DEMO);
    const { code } = await runCli(['rm', 'cli-demo', '--file', dataFile]);
    expect(code).toBe(0);
    const after = architectureDocumentSchema.parse(JSON.parse(await readFile(dataFile, 'utf8')));
    expect(after.nodes['cli-demo']).toBeUndefined();
    expect(Object.values(after.wires).some((wire) => wire.id.startsWith('cli-demo--'))).toBe(false);
  });

  it('rm removes a single node and its wires', async () => {
    await runCli(['apply', '--file', dataFile], DEMO);
    const { code, stdout } = await runCli(['rm', 'cli-demo', 'Demo client', '--file', dataFile]);
    expect(code, stdout).toBe(0);
    const after = architectureDocumentSchema.parse(JSON.parse(await readFile(dataFile, 'utf8')));
    expect(after.nodes['cli-demo--demo-client']).toBeUndefined();
    expect(after.nodes['cli-demo--demo-broker']).toBeDefined();
    expect(Object.values(after.wires).some((wire) => wire.source === 'cli-demo--demo-client')).toBe(false);
  });

  it('help teaches the grammar and every verb', async () => {
    const { code, stdout } = await runCli(['help']);
    expect(code).toBe(0);
    for (const verb of ['maps', 'read', 'apply', 'rm', 'snapshot']) expect(stdout).toContain(verb);
    expect(stdout).toContain('scope "');
    expect(stdout).toContain('wire');
    expect(stdout).toContain('->');
  });

  it('no args prints help too', async () => {
    const { stdout } = await runCli([]);
    expect(stdout).toContain('scope "');
  });
});
