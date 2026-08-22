/** Pure placement rules shared by the Canvas surface and creation actions. */

/** A point in diagram coordinates, rather than screen coordinates. */
export interface WorldPoint { x: number; y: number }

/** The geometry needed to decide containment and relative placement. */
export interface PlacedNode {
  id: string;
  kind: string;
  parentId?: string;
  position: WorldPoint;
  size: { width: number; height: number };
}

/** A resolved parent and position relative to that parent. */
export interface Placement { parentId: string | undefined; position: WorldPoint }

function byId(placed: PlacedNode[]): Map<string, PlacedNode> {
  return new Map(placed.map((node) => [node.id, node]));
}

function absolutePosition(nodes: Map<string, PlacedNode>, id: string): WorldPoint {
  const point = { x: 0, y: 0 };
  let cursor = nodes.get(id);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    point.x += cursor.position.x;
    point.y += cursor.position.y;
    cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
  }
  return point;
}

function isSelfOrAncestor(nodes: Map<string, PlacedNode>, id: string, ancestorId: string): boolean {
  let cursor: string | undefined = id;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === ancestorId) return true;
    seen.add(cursor);
    cursor = nodes.get(cursor)?.parentId;
  }
  return false;
}

function depth(nodes: Map<string, PlacedNode>, id: string): number {
  let steps = 0;
  let cursor = nodes.get(id)?.parentId;
  const seen = new Set<string>([id]);
  while (cursor && nodes.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    cursor = nodes.get(cursor)?.parentId;
    steps += 1;
  }
  return steps;
}

/** Returns the innermost group containing a diagram point. */
export function containingGroup(
  placed: PlacedNode[],
  point: WorldPoint,
  moving?: string,
): string | undefined {
  const nodes = byId(placed);
  return placed
    .filter((node) => node.kind === 'group')
    .filter((node) => !moving || !isSelfOrAncestor(nodes, node.id, moving))
    .filter((node) => {
      const origin = absolutePosition(nodes, node.id);
      return point.x >= origin.x && point.x <= origin.x + node.size.width
        && point.y >= origin.y && point.y <= origin.y + node.size.height;
    })
    .sort((left, right) => depth(nodes, right.id) - depth(nodes, left.id))[0]?.id;
}

/** Resolves an absolute diagram point to its containing group and relative position. */
export function placeInWorld(
  placed: PlacedNode[],
  topLeft: WorldPoint,
  moving?: string,
  hitPoint?: WorldPoint,
): Placement {
  const nodes = byId(placed);
  const parentId = containingGroup(placed, hitPoint ?? topLeft, moving);
  const origin = parentId ? absolutePosition(nodes, parentId) : { x: 0, y: 0 };
  return { parentId, position: { x: topLeft.x - origin.x, y: topLeft.y - origin.y } };
}

/** Resolves a React Flow drop to its new parent-relative placement. */
export function resolveDrop(
  placed: PlacedNode[],
  movedId: string,
  droppedAt: WorldPoint,
  droppedIn?: string,
): Placement {
  const nodes = byId(placed);
  const moved = nodes.get(movedId);
  if (!moved) return { parentId: droppedIn, position: droppedAt };
  const parentOrigin = droppedIn ? absolutePosition(nodes, droppedIn) : { x: 0, y: 0 };
  const topLeft = { x: parentOrigin.x + droppedAt.x, y: parentOrigin.y + droppedAt.y };
  const centre = { x: topLeft.x + moved.size.width / 2, y: topLeft.y + moved.size.height / 2 };
  return placeInWorld(placed, topLeft, movedId, centre);
}
