import { describe, expect, it } from 'vitest';
import { DEMO, dataDir, readRecord, runCli } from './cli-fixture.ts';

describe('canvas CLI', () => {
  it('check reports exact callout lines and corrections for every invalid item shape', async () => {
    const syntax = 'callout "text" id=<stable-id> kind=info|warning|decision|success';
    const cases = [
      {
        child: 'callout id=evidence kind=info',
        reason: 'callout needs text',
        line: 4,
      },
      {
        child: 'callout "Evidence is complete" kind=info',
        reason: 'callout needs id=<stable-id>',
        line: 4,
      },
      {
        child: 'callout "Evidence is complete" id=evidence',
        reason: 'callout needs kind=info|warning|decision|success',
        line: 4,
      },
      {
        child: 'callout "Evidence is complete" id=evidence kind=urgent',
        reason: 'unknown callout kind "urgent"; use one of: info|warning|decision|success',
        line: 4,
      },
    ];
    for (const invalid of cases) {
      const result = await runCli(['check', '--file', dataDir], `
scope "Callout Diagnostics"
  callout-stack "Release decision"
    ${invalid.child}
`);
      expect(result.code, result.stderr).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual({
        status: 'invalid',
        errors: [{ line: invalid.line, reason: invalid.reason, correction: syntax }],
      });
    }

    const duplicate = await runCli(['check', '--file', dataDir], `
scope "Callout Diagnostics"
  callout-stack "Release decision"
    callout "First" id=evidence kind=info
    callout "Second" id=evidence kind=warning
`);
    expect(duplicate.code, duplicate.stderr).toBe(1);
    expect(JSON.parse(duplicate.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 5,
        reason: 'duplicate callout id "evidence"',
        correction: syntax,
      }],
    });
  });

  it('applies an idempotent agent batch once and persists its authorship', async () => {
    await runCli(['apply', '--file', dataDir], DEMO);
    const before = await readRecord('cli-demo');
    const changeSet = {
      operationId: 'cli-agent-op-1',
      expectedRevision: before.revision,
      timestamp: '2026-08-05T12:00:00.000Z',
      commands: [{
        kind: 'node.add',
        node: {
          id: 'cli-added-node', kind: 'module', label: 'CLI added node',
          parentId: 'cli-demo', interfaceIds: [], typeIds: [],
        },
        placement: { position: { x: 20, y: 40 }, size: { width: 180, height: 90 } },
      }],
    };
    const first = await runCli(['batch', 'cli-demo', '--file', dataDir], JSON.stringify(changeSet));
    expect(first.code, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({ status: 'applied', revision: before.revision + 1 });

    const duplicate = await runCli(['batch', 'cli-demo', '--file', dataDir], JSON.stringify(changeSet));
    expect(duplicate.code).toBe(0);
    expect(JSON.parse(duplicate.stdout)).toMatchObject({ status: 'duplicate', originalRevision: before.revision + 1 });

    const after = await readRecord('cli-demo');
    expect(after.nodes['cli-added-node']).toBeDefined();
    expect(after.appliedOperations['cli-agent-op-1']).toMatchObject({
      actor: { id: 'canvas-cli', kind: 'system' },
      provenance: { source: 'cli' },
    });
  });

});
