/**
 * `comment` nodes are free-text notes (DSL keyword `note`), sized purely from label length.
 *
 * The formula is copied — not moved — from `src/domain/layout.ts`'s private `estimateCommentSize`:
 * `contentSize()` there still calls its own copy for now, and gets rewired onto this component in
 * a later task. Duplicating a two-line formula keeps that file working without adding an export
 * it doesn't otherwise need.
 */

import type { DiagramComponent } from '../component.ts';

export const commentComponent: DiagramComponent = {
  kind: 'comment',
  dslKeyword: 'note',
  layoutRole: 'leaf',
  measure: (node) => ({ width: 280, height: 48 + 21 * Math.ceil(node.label.length / 34) }),
};
