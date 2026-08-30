import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../../contract/records/components.ts';
import { DEMO, dataDir, dataHashes, runCli, writeFile, join } from './cli-fixture.ts';

describe('canvas CLI', () => {
  it('describes the record command vocabulary for an unfamiliar agent', async () => {
    const { code, stdout } = await runCli(['describe']);
    expect(code).toBe(0);
    const description = JSON.parse(stdout) as Record<string, unknown>;
    expect(description).toMatchObject({
      schemaVersion: 3,
      unit: 'diagram-record',
      nodeAliases: { group: 'scope' },
    });
    expect(description.commandKinds).toEqual([
      'node.add', 'node.move', 'node.resize', 'node.autoSize', 'node.pin', 'node.update',
      'node.content.set', 'node.reparent', 'node.remove',
      'wire.add', 'wire.reconnect', 'wire.setRoute', 'wire.setCardinality', 'wire.update', 'wire.remove',
      'interface.add', 'interface.update', 'interface.remove',
      'view.setCollapsed', 'view.setViewport', 'flow.activate',
      'layout.presentation.replace', 'layout.nodeAppearance.set', 'layout.wireAppearance.set',
      'layout.arrangement.set',
      'diagram.definitions.replace', 'diagram.flows.replace', 'diagram.rename', 'diagram.setOrientation',
    ]);
    const dsl = description.dsl as {
      components: Array<Record<string, unknown>>;
      wire: Record<string, unknown>;
    };
    expect(dsl.components.map((component) => component.kind)).toEqual([
      'group', 'module', 'object', 'runtime', 'resource', 'comment', 'tree', 'timeline',
      'metric', 'icon-card', 'icon-grid', 'callout-stack', 'block', 'ooux-object', 'entity',
    ]);
    expect(dsl.components.find((component) => component.kind === 'group')).toMatchObject({
      keyword: 'zone',
      arrangement: { layout: { values: ['stack', 'row', 'grid'] } },
    });
    expect(dsl.components.find((component) => component.kind === 'icon-card')).toMatchObject({
      keyword: 'icon-card',
      declaration: {
        syntax: `icon-card "title" icon=${ICON_NAMES.join('|')} description="text"`,
      },
      appearance: [],
    });
    const block = dsl.components.find((component) => component.kind === 'block');
    expect(block).toMatchObject({ keyword: 'block' });
    expect(block?.appearance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'icon', values: [...ICON_NAMES],
      }),
      expect.objectContaining({ key: 'vertical-align', values: ['top', 'center', 'bottom'] }),
    ]));
    expect(dsl.components.find((component) => component.kind === 'entity')).toMatchObject({
      keyword: 'entity',
      children: [{
        keyword: 'field',
        syntax: 'field "name" id=stable-id type=value-type [keys=pk,fk,uk]',
      }],
      appearance: [{
        key: 'palette', values: ['neutral', 'blue', 'violet', 'sage'],
        omitted: 'component default',
      }],
    });
    expect(dsl.wire).toMatchObject({
      endpoints: ['label', 'node.method', '@ref', '#node-id'],
      cardinality: {
        source: { key: 'source-cardinality', values: ['one', 'zero-or-one', 'one-or-many', 'zero-or-many'] },
        target: { key: 'target-cardinality', values: ['one', 'zero-or-one', 'one-or-many', 'zero-or-many'] },
      },
    });
    expect(dsl.wire.appearance).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'shape', values: ['elbow', 'straight', 'curved', 'stepped'] }),
    ]));
  });

  it('check validates and lays out file or stdin DSL without changing stored data', async () => {
    const candidate = join(dataDir, 'candidate.canvas');
    await writeFile(candidate, DEMO, 'utf8');
    const before = await dataHashes();

    const valid = await runCli(['check', candidate, '--file', dataDir]);
    expect(valid.code, valid.stderr).toBe(0);
    expect(JSON.parse(valid.stdout)).toEqual({
      status: 'valid',
      diagrams: [{ id: 'cli-demo', name: 'CLI Demo', nodes: 4, wires: 1 }],
      warnings: [],
    });

    const invalid = await runCli(['check', '--file', dataDir], 'scope Demo\n  banana "Split"\n');
    expect(invalid.code, invalid.stderr).toBe(1);
    expect(JSON.parse(invalid.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 2,
        reason: 'unknown statement "banana"',
        correction: expect.stringContaining('valid statements:'),
      }],
    });
    expect(await dataHashes()).toEqual(before);
  });

});
