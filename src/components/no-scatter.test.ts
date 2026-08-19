/**
 * The architecture guard: a kind's name may appear only where the seam allows.
 *
 * Component-owned children follow the same boundary. A selection names their shared shape; the
 * component registry decides whether any specific collection and item id exist.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SHAPES = ['timeline', 'metric', 'icon-card'] as const;
const COMMON_SEAMS = [
  'src/components/registry.ts', 'src/components/web-registry.tsx',
  'src/domain/model.ts', 'src/domain/records.ts',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (name === 'node_modules' || name === 'dist' || name === 'tests') return [];
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/test/.test(name) ? [path] : [];
  });
}

describe('registered shapes are pure additions', () => {
  it('no source file outside each shape folder and its registration seams names it', () => {
    for (const kind of SHAPES) {
      const allowed = [`src/components/${kind}/`, ...COMMON_SEAMS];
      for (const file of [...walk('src'), ...walk('tools/canvas-cli')]) {
        if (allowed.some((path) => file.includes(path))) continue;
        expect(readFileSync(file, 'utf8').includes(`'${kind}'`), `${kind}: ${file}`).toBe(false);
      }
    }
  });
});

describe('component items stay generic', () => {
  it('uses no child-specific selection variants', () => {
    for (const file of [
      'src/domain/model.ts',
      'src/presentation/canvas-actions.ts',
      'src/presentation/projection.ts',
      'src/presentation/components/inspect-panel.tsx',
      'src/components/timeline/web.tsx',
      'src/presentation/nodes/tree-node.tsx',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source.includes("'tree-row'"), file).toBe(false);
      expect(source.includes("'timeline-step'"), file).toBe(false);
    }
  });
});
