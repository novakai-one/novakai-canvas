/**
 * `comment` nodes are free-text notes (DSL keyword `note`), sized purely from label length.
 *
 * The layout state's `measureNode()` dispatches here through the registry instead of
 * keeping its own copy of this formula.
 */

import { textNodeDeclaration, type DiagramComponent } from '../component.ts';

export const commentComponent: DiagramComponent<'comment'> = {
  kind: 'comment',
  dslKeyword: 'note',
  declaration: textNodeDeclaration('note', 'Why this shape is load-bearing.'),
  creation: {
    category: 'annotation', label: 'Note', hint: 'Not part of the model',
    defaultLabel: 'Add context here', initialSize: { width: 240, height: 100 },
  },
  layoutRole: 'leaf',
  measure: (node) => ({ width: 280, height: 48 + 21 * Math.ceil(node.label.length / 34) }),
};
