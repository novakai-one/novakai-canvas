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
import { timelineComponent } from './timeline/component.ts';
import type { CanvasNode } from '../domain/records.ts';

// `satisfies`, not a `: DiagramComponent[]` annotation, so each entry keeps its own literal
// `kind` instead of widening to `string` — the pin below needs that to check anything real.
const components = [
  groupComponent,
  cardComponent('module'), cardComponent('object'), cardComponent('runtime'), cardComponent('resource'),
  commentComponent,
  treeComponent,
  timelineComponent,
] satisfies DiagramComponent[];

export function allComponents(): readonly DiagramComponent[] { return components; }
export function componentFor(kind: string): DiagramComponent {
  const found = components.find((c) => c.kind === kind);
  if (!found) throw new Error(`no component registered for kind "${kind}"`);
  return found;
}
export function kindList(): [string, ...string[]] {
  return components.map((c) => c.kind) as [string, ...string[]];
}

/** Extra stored fields owned by one node kind. */
export function contentFieldsFor(kind: string): Record<string, import('zod').ZodTypeAny> {
  return componentFor(kind).contentFields ?? {};
}

/**
 * Compile-time pin between the registry (this file, the one runtime copy of "which kinds
 * exist") and `CanvasNode['kind']` (`../domain/records.ts`, the one compile-time copy).
 *
 * `records.ts` must never import this file back — that import stays type-only and is erased at
 * runtime, so there's no cycle — but the reverse pin still has to hold: register a kind here
 * without adding it to `NodeKind`, or add it to `NodeKind` without registering it here, and this
 * line fails to typecheck. Nothing reads `kindsPinnedToDomainUnion`'s value; it exists only to
 * make drift a build error.
 */
type RegisteredKind = (typeof components)[number]['kind'];
type RecordKind = CanvasNode['kind'];
// Wrapped in tuples so the checked type isn't "naked" in the `extends` clause — a naked union
// there makes the conditional distribute member-by-member and collapse to `boolean` either way,
// which would make this pin pass even when the two sides differ.
type Exact<A extends string, B extends string> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const kindsPinnedToDomainUnion: Exact<RegisteredKind, RecordKind> = true;
