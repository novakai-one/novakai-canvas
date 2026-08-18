/**
 * The card kinds (`module`, `object`, `runtime`, `resource`) share one implementation: a
 * label/description/interfaces/types box sized by `estimateNodeSize`. They differ only in
 * `kind`, so one factory produces all four registry entries.
 */

import { estimateNodeSize } from '../../domain/layout.ts';
import type { DiagramComponent } from '../component.ts';

export function cardComponent(kind: 'module' | 'object' | 'runtime' | 'resource'): DiagramComponent {
  return {
    kind,
    dslKeyword: kind,
    layoutRole: 'leaf',
    measure: (node, ctx) => estimateNodeSize(node.label, node.description, ctx.interfaceLines, ctx.typeLines),
  };
}
