/** Package-boundary and component-registration guard for the Canvas capability. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SHAPES = [
  'timeline', 'metric', 'icon-card', 'icon-grid', 'callout-stack', 'block', 'ooux-object', 'entity',
] as const;
const COMMON_SEAMS = [
  'packages/canvas/core/components/registry.ts',
  'packages/canvas/core/components/component-palette.ts',
  'packages/canvas/contract/records/components.ts',
  'packages/canvas/contract/records/legacy-document.ts',
  'packages/canvas/contract/records/legacy.ts',
  'packages/canvas/contract/schemas/content.ts',
  'packages/canvas/contract/schemas/diagram.ts',
  'packages/canvas/contract/schemas/legacy-shapes.ts',
  'packages/canvas/contract/types/node-kind.ts',
  'src/components/web-registry.tsx',
];
const CONTRACT_FACADES = new Set([
  'packages/canvas/contract/api.ts',
  'packages/canvas/contract/authoring.ts',
  'packages/canvas/contract/compose.ts',
  'packages/canvas/contract/host.ts',
  'packages/canvas/contract/index.ts',
  'packages/canvas/contract/testing.ts',
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = `${dir}/${name}`;
    if (['node_modules', 'dist', 'tests', 'prototype'].includes(name)) return [];
    if (statSync(file).isDirectory()) return walk(file);
    return /\.(ts|tsx)$/.test(name) && !/test/.test(name) ? [file] : [];
  });
}

function walkPackage(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = `${dir}/${name}`;
    if (['node_modules', 'dist'].includes(name)) return [];
    if (statSync(file).isDirectory()) return walkPackage(file);
    return /\.(ts|tsx)$/.test(name) ? [file] : [];
  });
}

function sourceOf(file: string): string {
  return readFileSync(file, 'utf8');
}

describe('Canvas package boundaries', () => {
  it('keeps registered shapes cohesive and every dependency on its permitted side', () => {
    const packageFiles = walk('packages/canvas');
    const allPackageFiles = walkPackage('packages/canvas');
    const hostFiles = [...walk('src'), ...walk('tools')];
    const declarationFiles = packageFiles.filter((file) => (
      file.includes('/contract/')
      && !file.includes('/contract/compose/')
      && !CONTRACT_FACADES.has(file)
    ));

    for (const kind of SHAPES) {
      const allowed = [
        `packages/canvas/core/components/${kind}/`,
        `src/components/${kind}/`,
        ...COMMON_SEAMS,
      ];
      for (const file of [...packageFiles, ...hostFiles]) {
        if (allowed.some((path) => file.includes(path))) continue;
        expect(sourceOf(file).includes(`'${kind}'`), `${kind}: ${file}`).toBe(false);
      }
    }

    for (const file of hostFiles) {
      expect(sourceOf(file), file).not.toMatch(/packages\/canvas\/(core|adapters|cli)\//);
      expect(sourceOf(file), file).not.toMatch(/@novakai\/canvas\//);
    }
    for (const file of packageFiles.filter((file) => file.includes('/core/'))) {
      expect(sourceOf(file), file).not.toMatch(/contract\/(api|compose|index)/);
      expect(sourceOf(file), file).not.toMatch(/from ['"](react|react-dom|@xyflow\/react|node:)/);
    }
    for (const file of packageFiles.filter((file) => file.includes('/adapters/'))) {
      expect(sourceOf(file), file).not.toMatch(/from ['"][^'"]*core\//);
    }
    for (const file of packageFiles.filter((file) => file.includes('/cli/'))) {
      expect(sourceOf(file), file).not.toMatch(/from ['"][^'"]*core\//);
    }
    for (const file of declarationFiles) {
      expect(sourceOf(file), file).not.toMatch(/from ['"][^'"]*(core|adapters|cli)\//);
    }
    for (const file of allPackageFiles) {
      const lines = sourceOf(file).trimEnd().split(/\r?\n/).length;
      expect(lines, `${file} must stay below 200 lines`).toBeLessThan(200);
    }
    for (const file of allPackageFiles.filter((file) => file.includes('/tests/'))) {
      expect(sourceOf(file), file).not.toMatch(/from ['"][^'"]*(core|adapters|cli)\//);
    }
  });

  it('uses no child-specific selection variants', () => {
    for (const file of [
      'packages/canvas/contract/types/selection.ts',
      'src/presentation/canvas-actions.ts',
      'src/presentation/projection.ts',
      'src/presentation/components/inspect-panel.tsx',
      'src/components/timeline/web.tsx',
      'src/components/tree/web.tsx',
    ]) {
      const source = sourceOf(file);
      expect(source.includes("'tree-row'"), file).toBe(false);
      expect(source.includes("'timeline-step'"), file).toBe(false);
    }
  });
});
