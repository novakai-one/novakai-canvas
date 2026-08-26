import { describe, expect, it } from 'vitest';
import { dataDir, runCli, readFile, join } from './cli-fixture.ts';

describe('canvas CLI', () => {
  it('snapshot renders a map to SVG', async () => {
    const out = join(dataDir, 'project-scope.svg');
    const { code, stdout } = await runCli(['snapshot', 'project-scope', '-o', out, '--file', dataDir]);
    expect(code, stdout).toBe(0);
    const svg = await readFile(out, 'utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Novakai IDE');
  });

  it('help teaches the grammar and every verb', async () => {
    const { code, stdout } = await runCli(['help']);
    expect(code).toBe(0);
    for (const verb of ['maps', 'read', 'describe', 'batch', 'apply', 'check', 'rm', 'snapshot']) expect(stdout).toContain(verb);
    expect(stdout).toContain('scope "');
    expect(stdout).toContain('wire');
    expect(stdout).toContain('->');
  });

  it('no args prints help too', async () => {
    const { stdout } = await runCli([]);
    expect(stdout).toContain('scope "');
  });
});
