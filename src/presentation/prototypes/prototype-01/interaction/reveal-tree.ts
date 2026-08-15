/** Pure sectional layout for Mission and Stage Worlds. */
import type { ObjectRecord } from '../object-graph/contract';

export const ROOT_X = 440;
export const TOP = 160;
export const ROOT_PITCH = 210;
export const CHILD_PITCH = 154;
export const COLUMN_STEP = 480;

export type PlacedNode = {
  readonly record: ObjectRecord;
  /** Stable React Flow anchor; visual bounds grow around it by semantic tier. */
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly parentId: string | null;
  readonly hasChildren: boolean;
  readonly revealed: boolean;
  readonly sequenceLabel: string;
  readonly siblingIndex: number;
};

export type Layout = {
  readonly nodes: readonly PlacedNode[];
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly spineStart: number;
  readonly spineEnd: number;
  readonly maxDepth: number;
};

type ChildLookup = (stageId: string) => readonly ObjectRecord[];

const pad = (value: number) => String(value).padStart(2, '0');

function reserveY(occupied: Map<number, number[]>, depth: number, preferred: number): number {
  const used = occupied.get(depth) ?? [];
  let candidate = preferred;
  while (used.some((value) => Math.abs(value - candidate) < CHILD_PITCH - 8)) {
    candidate += CHILD_PITCH;
  }
  used.push(candidate);
  occupied.set(depth, used);
  return candidate;
}

function placeChildren(
  parent: PlacedNode,
  revealedIds: readonly string[],
  childrenOf: ChildLookup,
  occupied: Map<number, number[]>,
  out: PlacedNode[],
): void {
  if (!parent.revealed) return;

  const children = childrenOf(parent.record.id);
  const centre = (children.length - 1) / 2;

  children.forEach((record, index) => {
    const grandchildren = childrenOf(record.id);
    const depth = parent.depth + 1;
    const preferredY = parent.y + (index - centre) * CHILD_PITCH;
    const child: PlacedNode = {
      record,
      x: parent.x + COLUMN_STEP,
      y: reserveY(occupied, depth, preferredY),
      depth,
      parentId: parent.record.id,
      hasChildren: grandchildren.length > 0,
      revealed: grandchildren.length > 0 && revealedIds.includes(record.id),
      sequenceLabel: `${parent.sequenceLabel}.${pad(index + 1)}`,
      siblingIndex: index,
    };
    out.push(child);
    placeChildren(child, revealedIds, childrenOf, occupied, out);
  });
}

export function layoutMissionWorld(
  roots: readonly ObjectRecord[],
  revealedIds: readonly string[],
  childrenOf: ChildLookup,
): Layout {
  const nodes: PlacedNode[] = roots.map((record, index) => {
    const children = childrenOf(record.id);
    return {
      record,
      x: ROOT_X,
      y: TOP + index * ROOT_PITCH,
      depth: 0,
      parentId: null,
      hasChildren: children.length > 0,
      revealed: children.length > 0 && revealedIds.includes(record.id),
      sequenceLabel: pad(index + 1),
      siblingIndex: index,
    };
  });

  const occupied = new Map<number, number[]>();
  for (const root of [...nodes]) placeChildren(root, revealedIds, childrenOf, occupied, nodes);

  const minX = Math.min(...nodes.map((node) => node.x), ROOT_X);
  const maxX = Math.max(...nodes.map((node) => node.x), ROOT_X);
  const minY = Math.min(...nodes.map((node) => node.y), TOP);
  const maxY = Math.max(...nodes.map((node) => node.y), TOP);
  const maxDepth = nodes.reduce((deepest, node) => Math.max(deepest, node.depth), 0);

  return {
    nodes,
    bounds: {
      x: minX - 420,
      y: minY - 300,
      width: maxX - minX + 1180,
      height: maxY - minY + 620,
    },
    spineStart: roots.length > 0 ? TOP : 0,
    spineEnd: roots.length > 0 ? TOP + (roots.length - 1) * ROOT_PITCH : 0,
    maxDepth,
  };
}
