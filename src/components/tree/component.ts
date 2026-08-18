/**
 * `tree` nodes hold semantic hierarchy rows (`node.rows`, present only on this kind — every other
 * kind leaves it undefined). Thin for now: `measure` copies `estimateTreeSize` from
 * `src/domain/layout.ts`; content ownership and `renderSvg` move here in a later task.
 */

import { orderedTreeRows, treeRowDepth, treeRowText } from '../../domain/tree.ts';
import type { DiagramComponent } from '../component.ts';

export const treeComponent: DiagramComponent = {
  kind: 'tree',
  dslKeyword: 'tree',
  layoutRole: 'leaf',
  measure(node) {
    const rows = node.rows ?? [];
    const ordered = orderedTreeRows(rows);
    const longest = Math.max(0, ...ordered.map(
      (row) => treeRowDepth(rows, row) * 20 + treeRowText(row).length * 7.6,
    ));
    return {
      width: Math.min(640, Math.max(280, Math.round(36 + longest))),
      height: 56 + ordered.length * 24 + 14,
    };
  },
};
