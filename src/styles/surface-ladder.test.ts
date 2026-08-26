/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '@novakai/canvas';

/**
 * One stylesheet, read from disk, with its comments removed.
 *
 * Deliberately `fs` rather than a `?raw` import: vitest stubs CSS modules, so the import
 * resolved to an empty string and two of the three assertions below passed against nothing.
 * A guard that cannot fail is not a guard.
 */
function declarations(file: string): string {
  const path = fileURLToPath(new URL(file, import.meta.url));
  const text = readFileSync(path, 'utf8');
  if (text.length === 0) throw new Error(`${file} read as empty`);
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * The surface ladder, guarded.
 *
 * `--surface-page` is the darkest value in the system and belongs to the canvas alone. Panels
 * used it for inputs, checkboxes and the JSON view, which made the deepest surface in a panel
 * the darkest one — children darker than their parent, exactly inverted. This is the kind of
 * regression that reads as "fine" in a diff and only shows up as a panel full of holes.
 */
describe('panel surface ladder', () => {
  it('never paints a panel surface with the page colour', () => {
    for (const file of ['./shell.css', './inspector.css']) {
      const text = declarations(file);
      expect(text.length, file).toBeGreaterThan(0);
      expect(text, file).not.toContain('background: var(--surface-page)');
    }
  });

  it('keeps the page colour available to the canvas', () => {
    expect(declarations('./base.css')).toContain('var(--surface-page)');
  });

  it('orders the four surfaces from darkest page to lightest control', () => {
    const luminance = (hex: string): number => {
      const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
      return channels.reduce((total, channel) => total + channel, 0);
    };
    for (const preset of Object.values(THEME_PRESETS)) {
      const ladder = [
        preset.colors.canvas, preset.colors.panel, preset.colors.surface, preset.colors.raised,
      ].map(luminance);
      expect(ladder, preset.label).toEqual([...ladder].sort((left, right) => left - right));
    }
  });
});
