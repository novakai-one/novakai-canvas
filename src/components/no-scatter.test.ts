/**
 * The architecture guard: a kind's name may appear only where the seam allows.
 *
 * `timeline` was added after the registry existed, so it is the honest test of whether the seam
 * holds. Its name is allowed in its own folder, in the two registration files, and in
 * `records.ts` — the compile-time kind union, which TypeScript cannot derive from a runtime
 * list. Anywhere else means a builder hardcoded a kind again and the seam has rotted, which
 * nothing else catches: the compiler, the renders, and the browser all stay green.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ALLOWED = [
  'src/components/timeline/',
  'src/components/registry.ts',
  'src/components/web-registry.tsx',
  'src/domain/records.ts',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (name === 'node_modules' || name === 'dist' || name === 'tests') return [];
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/test/.test(name) ? [path] : [];
  });
}

describe('timeline is a pure addition', () => {
  it('no source file outside its folder names it', () => {
    for (const file of [...walk('src'), ...walk('tools/canvas-cli')]) {
      if (ALLOWED.some((allowed) => file.includes(allowed))) continue;
      expect(readFileSync(file, 'utf8').includes("'timeline'"), file).toBe(false);
    }
  });
});
