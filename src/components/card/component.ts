/**
 * The card kinds (`module`, `object`, `runtime`, `resource`) share one implementation: a
 * label/description/interfaces/types box sized by `estimateNodeSize`. They differ only in
 * `kind`, so one factory produces all four registry entries.
 */

import { estimateNodeSize } from './measure.ts';
import { namedNodeDeclaration, type DiagramComponent } from '../component.ts';

export function cardComponent<K extends 'module' | 'object' | 'runtime' | 'resource'>(kind: K): DiagramComponent<K> {
  return {
    kind,
    dslKeyword: kind,
    declaration: namedNodeDeclaration(kind, 'Session broker', 'Owns leases and allocation'),
    layoutRole: 'leaf',
    measure: (node, ctx) => estimateNodeSize(node.label, node.description, ctx.interfaceLines, ctx.typeLines),
  };
}
