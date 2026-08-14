/**
 * Where the nodes of a Mission World sit.
 *
 * Pure layout maths, kept out of React and out of CSS: domain records carry no
 * coordinates, so the Room projection has to own them, and owning them in one testable
 * function is cheaper than scattering `top:` calculations through JSX.
 *
 * The shape it produces is the plumb line: roots run top to bottom on a single vertical
 * rule, and anything revealed grows rightward as a branch of that same drawing.
 */
import type { ObjectRecord } from '../object-graph/contract';

export const SPINE_X = 132;
export const NODE_WIDTH = 268;
export const NODE_HEIGHT = 140;
export const CLAMP_GAP = 34;
/** Vertical distance between two consecutive stages on the spine. */
export const ROW_PITCH = 180;
/** Vertical distance between two revealed siblings. */
export const CHILD_PITCH = 164;
/** How far right each level of revealed structure sits. */
export const COLUMN_STEP = 340;
export const TOP = 64;

export type PlacedNode = {
  readonly record: ObjectRecord;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly parentId: string | null;
  readonly hasChildren: boolean;
  readonly revealed: boolean;
};

export type Layout = {
  readonly nodes: readonly PlacedNode[];
  /** Y of the last root node's clamp — how far the spine's bright reach extends. */
  readonly spineEnd: number;
  readonly width: number;
  readonly height: number;
};

type ChildLookup = (stageId: string) => readonly ObjectRecord[];

/**
 * Places one stage and, when it is revealed, its subtree to the right.
 * Returns the vertical space the whole subtree consumed so the caller can advance.
 */
function place(
  record: ObjectRecord,
  depth: number,
  parentId: string | null,
  top: number,
  revealedIds: readonly string[],
  childrenOf: ChildLookup,
  out: PlacedNode[],
): number {
  const children = childrenOf(record.id);
  const isRevealed = revealedIds.includes(record.id) && children.length > 0;

  out.push({
    record,
    x: SPINE_X + CLAMP_GAP + depth * COLUMN_STEP,
    y: top,
    depth,
    parentId,
    hasChildren: children.length > 0,
    revealed: isRevealed,
  });

  if (!isRevealed) return NODE_HEIGHT;

  let cursor = top;
  for (const child of children) {
    const consumed = place(child, depth + 1, record.id, cursor, revealedIds, childrenOf, out);
    cursor += Math.max(CHILD_PITCH, consumed + (CHILD_PITCH - NODE_HEIGHT));
  }
  return Math.max(NODE_HEIGHT, cursor - top);
}

export function layoutMissionWorld(
  roots: readonly ObjectRecord[],
  revealedIds: readonly string[],
  childrenOf: ChildLookup,
): Layout {
  const nodes: PlacedNode[] = [];
  let cursor = TOP;
  let spineEnd = TOP;

  for (const root of roots) {
    spineEnd = cursor + NODE_HEIGHT / 2;
    const consumed = place(root, 0, null, cursor, revealedIds, childrenOf, nodes);
    cursor += Math.max(ROW_PITCH, consumed + (ROW_PITCH - NODE_HEIGHT));
  }

  const maxDepth = nodes.reduce((deepest, node) => Math.max(deepest, node.depth), 0);
  const maxY = nodes.reduce((lowest, node) => Math.max(lowest, node.y + NODE_HEIGHT), TOP);

  return {
    nodes,
    spineEnd,
    width: SPINE_X + CLAMP_GAP + (maxDepth + 1) * COLUMN_STEP + 80,
    height: maxY + 120,
  };
}

/**
 * The elbow that connects a revealed parent to one of its children: out of the parent's
 * right edge, down or up the gutter, then into the child's left edge.
 */
export function branchPath(parent: PlacedNode, child: PlacedNode): string {
  const startX = parent.x + NODE_WIDTH;
  const startY = parent.y + NODE_HEIGHT / 2;
  const endX = child.x;
  const endY = child.y + NODE_HEIGHT / 2;
  const gutter = startX + (endX - startX) / 2;
  const radius = Math.min(12, Math.abs(endY - startY) / 2);

  if (Math.abs(endY - startY) < 2) return `M ${startX} ${startY} H ${endX}`;

  const sweep = endY > startY ? 1 : 0;
  const dir = endY > startY ? 1 : -1;
  return [
    `M ${startX} ${startY}`,
    `H ${gutter - radius}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${gutter} ${startY + radius * dir}`,
    `V ${endY - radius * dir}`,
    `A ${radius} ${radius} 0 0 ${sweep === 1 ? 0 : 1} ${gutter + radius} ${endY}`,
    `H ${endX}`,
  ].join(' ');
}
