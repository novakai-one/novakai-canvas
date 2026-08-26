import { describe, expect, it } from 'vitest';
import { defaultPreferences } from './defaults';
import { canvasPreferencesSchema } from './schema';

/**
 * What the app is like before anybody has touched a setting.
 *
 * Every judgement call in the studio rework became a preference rather than a guess, so the
 * defaults are the one place a guess still happens — and two of them are load, not taste.
 */
describe('preference defaults', () => {
  it('never re-frames the camera on its own', () => {
    // Chris has asked for this twice. The setting exists because some people like it; the
    // default exists because the camera moving unbidden is the thing he cannot stand.
    expect(defaultPreferences.panel.reframeOnPanelMove).toBe(false);
  });

  it('routes wires around unrelated nodes, and keeps sections one at a time', () => {
    expect(defaultPreferences.wires.avoidNodes).toBe(true);
    expect(defaultPreferences.panel.sections).toBe('accordion');
  });

  it('validates against its own schema', () => {
    expect(() => canvasPreferencesSchema.parse(defaultPreferences)).not.toThrow();
  });

  it('still opens a preferences file written before any of these settings existed', () => {
    const old = {
      schemaVersion: 1,
      appearance: { density: 'comfortable', radius: 6, theme: 'dark', accent: 'gold' },
      canvas: {
        showGrid: false,
        snapToGrid: true,
        gridSize: 8,
        showControls: true,
        showLegend: true,
      },
      nodes: {
        showKinds: true,
        showDescriptions: false,
        showInterfaces: 'always',
        showTypes: true,
        showPorts: 'hover',
      },
      wires: { showLabels: 'selected', width: 1.25, dimUnrelated: true },
      panel: { width: 380, defaultTab: 'inspect', showEmptyFields: false },
      files: { autoSave: true, saveDelay: 500 },
    };
    const parsed = canvasPreferencesSchema.parse(old);
    // Absent means "the behaviour this file was written under", which for every one of the new
    // settings is the same as the default. Nothing changes shape under an old owner.
    expect(parsed.wires.shape).toBeUndefined();
    expect(parsed.wires.maxLabelSize).toBeUndefined();
    expect(parsed.panel.sections).toBeUndefined();
    expect(parsed.canvas.targetSize).toBeUndefined();
    expect('showLegend' in parsed.canvas).toBe(false);
  });

  it('refuses a text or label scale outside what the type system can carry', () => {
    const tooBig = {
      ...defaultPreferences,
      appearance: { ...defaultPreferences.appearance, textScale: 4 },
    };
    expect(() => canvasPreferencesSchema.parse(tooBig)).toThrow();
    expect(() => canvasPreferencesSchema.parse({
      ...defaultPreferences,
      wires: { ...defaultPreferences.wires, maxLabelSize: 30 },
    })).toThrow();
  });
});
