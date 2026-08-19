import { asId } from '../domain/id-cast';
import type { NodeId } from '../domain/ids';
import type { Selection } from '../domain/model';
import type { ProjectedView } from '../domain/project-view';
import type { CanvasNode, DiagramRecord } from '../domain/records';
import { componentFor } from '../components/registry';

/** Node kinds the toolbar can create. Trees are authored by the CLI, so they are not offered. */
export type CreatableNodeKind = 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'group';

/** Semantic node and initial geometry produced for one `node.add` command. */
export interface CreatedCanvasNode {
  node: CanvasNode;
  placement: { position: { x: number; y: number }; size: { width: number; height: number } };
}

/** A point in the diagram's own coordinates — the space nodes are placed in, not the screen's. */
export interface WorldPoint { x: number; y: number }

/**
 * The geometry of one drawn node, as the canvas stores it.
 *
 * `position` is relative to `parentId`, the way both the record and React Flow express nesting.
 * Nothing else about a node matters to placement, so nothing else is asked for.
 */
export interface PlacedNode {
  id: string;
  kind: string;
  parentId?: string;
  position: WorldPoint;
  size: { width: number; height: number };
}

/** A resolved home for a node: which frame holds it, and where it sits inside that frame. */
export interface Placement { parentId: string | undefined; position: WorldPoint }

/**
 * The diagram's own frame: the one group with no parent.
 *
 * Placement no longer needs this — a node's home is decided by where it lands — but the
 * inspector still asks, because the root frame is the one node a diagram cannot be without.
 */
export function rootGroupId(record: DiagramRecord): NodeId | undefined {
  return Object.values(record.nodes)
    .find((node) => node.kind === 'group' && !node.parentId)?.id;
}

/** The drawn diagram reduced to pure geometry, which is all the placement rules need. */
export function placedNodes(view: ProjectedView): PlacedNode[] {
  return view.nodes.map((node) => ({
    id: node.id as string,
    kind: node.kind,
    parentId: node.parentId as string | undefined,
    position: node.position,
    size: node.size,
  }));
}

const NODE_SIZE: Record<string, { width: number; height: number }> = {
  comment: { width: 240, height: 100 },
  group: { width: 480, height: 300 },
};
const DEFAULT_NODE_SIZE = { width: 200, height: 110 };

function byId(placed: PlacedNode[]): Map<string, PlacedNode> {
  return new Map(placed.map((node) => [node.id, node]));
}

/** Absolute top-left of a node, walking the parent chain; cycles and gaps stop the walk. */
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

/** True when `ancestorId` is `id` itself or anywhere above it. */
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

/**
 * The frame a point falls in: the innermost group whose box contains it, or none.
 *
 * Membership is decided by where a thing lands, never by where it was allowed to go. `moving`
 * names a node being placed so it cannot be swallowed by itself or by a group it contains.
 */
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

/**
 * Where a world point belongs: its frame, and its coordinates inside that frame.
 *
 * This is the whole of "a true canvas". Nothing is clamped and nothing is refused — a point
 * outside every group is simply a point at the top level, and the answer is always a real home.
 */
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

/**
 * Where a node lands after a drag, and which frame now holds it.
 *
 * React Flow hands back a position relative to the parent the node started in, so the drop is
 * resolved in absolute coordinates and then expressed relative to whatever frame it landed in.
 * The node's centre decides membership: an object half over a boundary belongs to the group it
 * is mostly in, which is what the eye reads.
 */
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

/**
 * Builds a new node centred on a point the user chose, ready for one `node.add` command.
 *
 * ID generation stays at the UI edge — the capability accepts an identity, it never invents one.
 * The point is where the user is looking; the frame it falls in is the node's parent. Nothing is
 * placed at a fixed coordinate off in the diagram somewhere the user is not.
 */
export function createCanvasNode(
  placed: PlacedNode[],
  kind: CreatableNodeKind,
  id: string,
  at: WorldPoint,
): CreatedCanvasNode {
  const label = kind === 'comment' ? 'Add context here'
    : kind === 'group' ? 'New group'
      : `New ${kind}`;
  const size = NODE_SIZE[kind] ?? DEFAULT_NODE_SIZE;
  const topLeft = { x: at.x - size.width / 2, y: at.y - size.height / 2 };
  const placement = placeInWorld(placed, topLeft, undefined, at);
  return {
    node: {
      id: asId<NodeId>(id),
      kind,
      label,
      parentId: placement.parentId ? asId<NodeId>(placement.parentId) : undefined,
      interfaceIds: [],
      typeIds: [],
    },
    placement: { position: placement.position, size },
  };
}

/**
 * Where Escape takes the current selection: one step outward, never sideways.
 *
 * Selection is a stack the user climbs down: a node hands attention to the group that holds it,
 * a group with nothing above it hands it back to the diagram. Anything that is not a node —
 * a wire, an interface, a type — has no enclosing frame worth stepping into, so it clears.
 * Escape never moves the camera; this function only ever names the next selection.
 */
export function escapeStep(record: DiagramRecord, selection: Selection): Selection {
  if (!selection) return null;
  if (selection.kind !== 'node') return null;
  const parentId = record.nodes[selection.id]?.parentId;
  if (!parentId || !record.nodes[parentId]) return null;
  return { kind: 'node', id: parentId as string };
}

/**
 * Whether the object a selection names still exists.
 *
 * Undo and remove can delete the thing under the cursor while the selection still points at it.
 * A selection nothing answers to is worse than none: the inspector empties and the "dim
 * everything unrelated" rule dims the whole canvas around an object that is not there. The
 * surface drops such a selection rather than rendering the ghost.
 */
export function selectionResolves(record: DiagramRecord, selection: Selection): boolean {
  if (!selection) return true;
  switch (selection.kind) {
    case 'node': return Boolean(record.nodes[selection.id]);
    case 'component-item': {
      const node = record.nodes[selection.nodeId];
      return Boolean(node && componentFor(node.kind).items?.(node).some(
        (item) => item.collection === selection.collection && item.id === selection.itemId,
      ));
    }
    case 'wire': return Boolean(record.wires[selection.id]);
    case 'interface': return Boolean(record.interfaces[selection.id]);
    case 'type': return Boolean(record.types[selection.id]);
    default: return true;
  }
}
