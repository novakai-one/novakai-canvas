import type { ProjectedView } from '@novakai/canvas';
import type { DiagramRecord } from '@novakai/canvas';
import { scopeDepth } from '../projection';

/** One row of the contents list: what it is, what it is called, how deep it sits. */
export interface ContentRow {
  id: string;
  kind: string;
  label: string;
  /** Nesting level below the diagram's own container, capped so deep trees stay legible. */
  depth: number;
}

/** How far a row is indented per level of nesting, in pixels. */
const INDENT_STEP = 8;
/** Past this depth the indent stops growing; four steps is already a lot of left margin. */
const MAX_DEPTH = 3;

export function contentIndent(depth: number): number {
  return Math.min(depth, MAX_DEPTH) * INDENT_STEP;
}

/**
 * What the open diagram contains, ordered the way it is drawn: outermost first, then by name.
 *
 * Pure, and separate from any panel, because this list is navigation of the canvas and
 * navigation belongs on the left with everything else that changes what you are looking at.
 * The right panel used to draw it as filler whenever nothing was selected, which is what made
 * the Studio turn into a navigator without being asked.
 *
 * Only what is visible is listed. A contents list that names objects the canvas is not showing
 * is a second, disagreeing answer to "what is in this diagram".
 */
export function diagramContents(record: DiagramRecord, view: ProjectedView): ContentRow[] {
  const rootId = view.nodes.find((node) => !node.parentId)?.id;
  const depthOf = (id: string): number => {
    const node = record.nodes[id];
    return node ? Math.max(scopeDepth(record.nodes, node) - 1, 0) : 0;
  };
  return view.nodes
    .filter((node) => node.id !== rootId)
    .map((node) => ({
      id: node.id as string,
      kind: node.kind,
      label: node.label,
      depth: depthOf(node.id as string),
    }))
    .sort((left, right) => left.depth - right.depth || left.label.localeCompare(right.label));
}
