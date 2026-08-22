/**
 * The card kinds (`module`, `object`, `runtime`, `resource`) share one implementation: a
 * label/description/interfaces/types box sized by `estimateNodeSize`. They differ only in
 * `kind`, so one factory produces all four registry entries.
 */

import { estimateNodeSize } from './measure.ts';
import { namedNodeDeclaration, type DiagramComponent } from '../component.ts';

const LABELS = {
  module: ['Module', 'A part that does something'],
  object: ['Object', 'A thing that is passed around'],
  runtime: ['Runtime', 'Something running'],
  resource: ['Resource', 'Something stored or external'],
} as const;

export function cardComponent<K extends 'module' | 'object' | 'runtime' | 'resource'>(kind: K): DiagramComponent<K> {
  return {
    kind,
    dslKeyword: kind,
    declaration: namedNodeDeclaration(kind, 'Session broker', 'Owns leases and allocation'),
    creation: {
      category: 'shape', label: LABELS[kind][0], hint: LABELS[kind][1],
      defaultLabel: `New ${kind}`, initialSize: { width: 200, height: 110 },
    },
    resize: { minSize: { width: 160, height: 80 } },
    layoutRole: 'leaf',
    appearanceKeys: ['badge'],
    measure: (node, ctx) => estimateNodeSize(node.label, node.description, ctx.interfaceLines, ctx.typeLines),
  };
}
