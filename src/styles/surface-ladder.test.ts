/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
    const tokens = declarations('./tokens.css');
    const value = (name: string): number => {
      const hex = new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(tokens)?.[1];
      if (!hex) throw new Error(`${name} is not defined as a hex value`);
      return parseInt(hex.slice(0, 2), 16);
    };
    const ladder = ['--surface-page', '--surface-1', '--surface-2', '--surface-3'].map(value);
    expect(ladder).toEqual([...ladder].sort((left, right) => left - right));
  });
});
