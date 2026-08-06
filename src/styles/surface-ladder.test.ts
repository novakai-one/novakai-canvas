import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** One stylesheet with its comments removed, so prose about a token is not a use of it. */
function declarations(file: string): string {
  const path = fileURLToPath(new URL(file, import.meta.url));
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
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
      expect(declarations(file), file).not.toContain('background: var(--surface-page)');
    }
  });

  it('keeps the page colour available to the canvas', () => {
    expect(declarations('./base.css')).toContain('var(--surface-page)');
  });

  it('orders the four surfaces from darkest page to lightest control', () => {
    const tokens = declarations('./tokens.css');
    const value = (name: string): number => {
      const hex = new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(tokens)?.[1];
      return hex ? parseInt(hex.slice(0, 2), 16) : Number.NaN;
    };
    const ladder = ['--surface-page', '--surface-1', '--surface-2', '--surface-3'].map(value);
    expect(ladder).toEqual([...ladder].sort((left, right) => left - right));
  });
});
