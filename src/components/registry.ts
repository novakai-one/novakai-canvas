/**
 * The one list of diagram shapes.
 *
 * Order is the DSL help order. Everything that used to keep its own copy of "which kinds exist"
 * — the record/document schemas, the DSL parser and printer, the layout engine, the web node
 * types — reads this list instead.
 */

import type { DiagramComponent } from './component.ts';
import { cardComponent } from './card/component.ts';
import { commentComponent } from './comment/component.ts';
import { groupComponent } from './group/component.ts';
import { treeComponent } from './tree/component.ts';

const components: DiagramComponent[] = [
  groupComponent,
  cardComponent('module'), cardComponent('object'), cardComponent('runtime'), cardComponent('resource'),
  commentComponent,
  treeComponent,
];

export function allComponents(): readonly DiagramComponent[] { return components; }
export function componentFor(kind: string): DiagramComponent {
  const found = components.find((c) => c.kind === kind);
  if (!found) throw new Error(`no component registered for kind "${kind}"`);
  return found;
}
export function kindList(): [string, ...string[]] {
  return components.map((c) => c.kind) as [string, ...string[]];
}
