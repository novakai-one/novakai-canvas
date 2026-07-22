/** Pure derivations over tree-node rows shared by layout and renderers. */

import type { TreeRow } from './model';

/** Indentation depth of a row via its parent chain (cycle-safe). */
export function treeRowDepth(rows: TreeRow[], row: TreeRow): number {
  const byId = new Map(rows.map((item) => [item.id, item]));
  let depth = 0;
  const seen = new Set<string>([row.id]);
  let current = row;
  while (current.parentRowId && byId.has(current.parentRowId) && !seen.has(current.parentRowId)) {
    current = byId.get(current.parentRowId) as TreeRow;
    seen.add(current.id);
    depth += 1;
  }
  return depth;
}

/** Canonical display text for a row; identity stays the stored fact. */
export function treeRowText(row: TreeRow): string {
  if (row.label) return row.label;
  const status = row.status ? `  [${row.status}]` : '';
  const badges = row.badges.map((badge) => ` ◆${badge}`).join('');
  return `${row.id}${status}${badges}`;
}

/** Rows in render order: children directly under their parent, input order kept. */
export function orderedTreeRows(rows: TreeRow[]): TreeRow[] {
  const byParent = new Map<string | undefined, TreeRow[]>();
  const ids = new Set(rows.map((row) => row.id));
  for (const row of rows) {
    const parent = row.parentRowId && ids.has(row.parentRowId) ? row.parentRowId : undefined;
    const bucket = byParent.get(parent) ?? [];
    bucket.push(row);
    byParent.set(parent, bucket);
  }
  const ordered: TreeRow[] = [];
  const visit = (parent: string | undefined): void => {
    for (const row of byParent.get(parent) ?? []) {
      ordered.push(row);
      visit(row.id);
    }
  };
  visit(undefined);
  return ordered;
}
