import { asId } from '@novakai/canvas';
import type { NodeId } from '@novakai/canvas';
import type { Selection } from '@novakai/canvas';
import type { ProjectedView } from '@novakai/canvas';
import type { DiagramNode as CanvasNode, DiagramRecord } from '@novakai/canvas';
import { componentFor } from '@novakai/canvas';
import { placeInWorld, type PlacedNode, type WorldPoint } from './canvas-placement';

export {
  containingGroup, placeInWorld, resolveDrop,
} from './canvas-placement';
export type { Placement, PlacedNode, WorldPoint } from './canvas-placement';

/** Node kinds the toolbar can create. Trees are authored by the CLI, so they are not offered. */
export type CreatableNodeKind = CanvasNode['kind'];

/** Semantic node and initial geometry produced for one `node.add` command. */
export interface CreatedCanvasNode {
  node: CanvasNode;
  placement: {
    position: { x: number; y: number };
    size: { width: number; height: number };
    sizeMode?: 'auto' | 'manual';
  };
}

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
  const creation = componentFor(kind).creation;
  if (!creation) throw new Error(`component-not-ui-creatable:${kind}`);
  const size = creation.initialSize;
  const topLeft = { x: at.x - size.width / 2, y: at.y - size.height / 2 };
  const placement = placeInWorld(placed, topLeft, undefined, at);
  const node: CanvasNode = {
    id: asId<NodeId>(id),
    kind,
    label: creation.defaultLabel,
    parentId: placement.parentId ? asId<NodeId>(placement.parentId) : undefined,
    interfaceIds: [],
    typeIds: [],
  };
  if (creation.stableIdField) {
    (node as unknown as Record<string, unknown>)[creation.stableIdField] = id;
  }
  return {
    node,
    placement: {
      position: placement.position,
      size,
      ...(creation.initialSizeMode ? { sizeMode: creation.initialSizeMode } : {}),
    },
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
