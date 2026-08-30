import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../../contract/records/components.ts';
import { dataDir, readRecord, dataHashes, runCli } from './cli-fixture.ts';

describe('canvas CLI', () => {
  it('discovers, checks, applies, and revisions presentation without a check write', async () => {
    const dsl = `
scope "Presentation CLI" layout=stack gap=8
  block "Signal" size=20 weight=600 align=center text=green border-color=green border=1 radius=8 padding=12
    line "Ready"
  module "Worker" badge=hide
`;
    const described = await runCli(['describe']);
    expect(described.code, described.stderr).toBe(0);
    expect(described.stdout).toContain('"grid"');
    expect(described.stdout).toContain('"columns"');
    expect(described.stdout).toContain('"border-color"');
    expect(described.stdout).toContain('"badge"');

    const beforeCheck = await dataHashes();
    const checked = await runCli(['check', '--file', dataDir], dsl);
    expect(checked.code, checked.stderr).toBe(0);
    expect(await dataHashes()).toEqual(beforeCheck);

    const applied = await runCli([
      'apply', '--file', dataDir, '--operation-id', 'presentation-green',
    ], dsl);
    expect(applied.code, applied.stderr).toBe(0);
    const green = await readRecord('presentation-cli');
    const layoutId = green.views[green.activeViewId].layoutId;
    expect(green.layouts[layoutId].appearanceByNodeId).toMatchObject({
      'presentation-cli--block-signal': {
        size: 20, weight: 600, align: 'center', text: 'green',
        borderColor: 'green', border: 1, radius: 8, padding: 12,
      },
      'presentation-cli--worker': { badge: 'hide' },
    });
    expect(green.layouts[layoutId].arrangementByContainerId?.['presentation-cli'])
      .toMatchObject({ layout: 'stack', gap: 8, align: 'stretch' });

    const blueApply = await runCli([
      'apply', '--file', dataDir, '--operation-id', 'presentation-blue',
    ], dsl.replace('text=green', 'text=blue'));
    expect(blueApply.code, blueApply.stderr).toBe(0);
    const blue = await readRecord('presentation-cli');
    expect(blue.revision).toBe(green.revision + 1);
    expect(blue.nodes).toEqual(green.nodes);
    expect(blue.layouts[layoutId].appearanceByNodeId?.['presentation-cli--block-signal']?.text)
      .toBe('blue');
  });

  it('check reports missing and unknown icon-card content with usable corrections', async () => {
    const missing = await runCli(['check', '--file', dataDir], `
scope "Icon Diagnostics"
  icon-card "Automated checks" icon=check
`);
    expect(missing.code, missing.stderr).toBe(1);
    expect(JSON.parse(missing.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 3,
        reason: 'icon-card needs description="text"',
        correction: `icon-card "title" icon=${ICON_NAMES.join('|')} description="text"`,
      }],
    });

    const unknown = await runCli(['check', '--file', dataDir], `
scope "Icon Diagnostics"
  icon-card "Automated checks" icon=rocket description="Every change is verified."
`);
    expect(unknown.code, unknown.stderr).toBe(1);
    expect(JSON.parse(unknown.stdout)).toEqual({
      status: 'invalid',
      errors: [{
        line: 3,
        reason: `unknown icon "rocket"; use one of: ${ICON_NAMES.join('|')}`,
        correction: `icon-card "title" icon=${ICON_NAMES.join('|')} description="text"`,
      }],
    });
  });

});
