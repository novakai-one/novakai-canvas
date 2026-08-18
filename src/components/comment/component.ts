/**
 * `comment` nodes are free-text notes (DSL keyword `note`), sized purely from label length.
 *
 * `src/domain/layout.ts`'s `contentSize()` dispatches here through the registry instead of
 * keeping its own copy of this formula.
 */

import type { DiagramComponent } from '../component.ts';

export const commentComponent: DiagramComponent = {
  kind: 'comment',
  dslKeyword: 'note',
  layoutRole: 'leaf',
  measure: (node) => ({ width: 280, height: 48 + 21 * Math.ceil(node.label.length / 34) }),
};
