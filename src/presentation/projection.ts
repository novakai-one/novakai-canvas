import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { CanvasPreferences, InterfaceObject, Selection, TypeObject } from '../domain/model';
import type { PositionedNode, ProjectedView } from '../domain/project-view';
import type { DiagramRecord, NodeKind, WireKind } from '../domain/records';
import { wireKindColor } from './wire-styles';

/** Presentation data required by architecture nodes. */
export interface ArchitectureNodeData extends Record<string, unknown> {
  node: PositionedNode;
  interfaces: InterfaceObject[];
  types: TypeObject[];
  preferences: CanvasPreferences;
  selection: Selection;
  editable: boolean;
  select: (selection: Selection) => void;
}

/** Presentation data required by elbow wires. */
export interface ArchitectureEdgeData extends Record<string, unknown> {
  label: string;
  kind: WireKind;
  preferences: CanvasPreferences;
  editable: boolean;
  select: () => void;
}

/**
 * Everything the React Flow projection reads.
 *
 * The projected view decides what is visible; the record is consulted only for the objects a
 * node names — its interfaces and types — which carry no geometry and so have no place in the
 * view. Nothing here re-derives visibility, because that policy lives in `projectView` alone.
 */
export interface ProjectionInput {
  view: ProjectedView;
  record: DiagramRecord;
  preferences: CanvasPreferences;
  selection: Selection;
  editable: boolean;
  select: (selection: Selection) => void;
}

/** The minimum a node must expose to be placed in the parent chain. */
interface NestedNode { id: string; parentId?: string }

function selectedOwner(record: DiagramRecord, selection: Selection): string | null {
  if (!selection) return null;
  if (selection.kind === 'node') return selection.id;
  if (selection.kind === 'tree-row') return selection.nodeId;
  if (selection.kind === 'interface') return record.interfaces[selection.id]?.ownerId ?? null;
  if (selection.kind === 'type') {
    return Object.values(record.nodes)
      .find((node) => (node.typeIds as string[]).includes(selection.id))?.id ?? null;
  }
  return null;
}

function connectedIds(input: ProjectionInput): Set<string> {
  const { record, selection, view } = input;
  const owner = selectedOwner(record, selection);
  if (!selection || (!owner && selection.kind !== 'wire')) return new Set();
  if (selection.kind === 'wire') {
    const wire = view.wires.find((candidate) => candidate.id === selection.id);
    return wire ? new Set([wire.source.nodeId as string, wire.target.nodeId as string]) : new Set();
  }
  const ids = new Set([owner as string]);
  // A group has no wires of its own, so relatedness for a group is containment: everything it
  // holds. Without this, selecting a frame greys out the entire diagram it frames.
  if (record.nodes[owner as string]?.kind === 'group') {
    let grew = true;
    while (grew) {
      grew = false;
      view.nodes.forEach((node) => {
        if (node.parentId && ids.has(node.parentId as string) && !ids.has(node.id as string)) {
          ids.add(node.id as string);
          grew = true;
        }
      });
    }
  }
  view.wires.forEach((wire) => {
    if (wire.source.nodeId === owner) ids.add(wire.target.nodeId);
    if (wire.target.nodeId === owner) ids.add(wire.source.nodeId);
  });
  return ids;
}

/** Nesting depth via the parentId chain; cycles and missing parents stop the walk. */
export function scopeDepth(nodes: Record<string, NestedNode>, node: NestedNode): number {
  let depth = 0;
  let current = node;
  const seen = new Set<string>([node.id]);
  while (current.parentId && nodes[current.parentId] && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = nodes[current.parentId];
    depth += 1;
  }
  return depth;
}

/**
 * Which renderer draws one node kind.
 *
 * `group` maps to the `scope` renderer: the record model renamed the kind, the container drawing
 * it needs is the same one, and re-labelling the React Flow node type would only rename a CSS
 * contract for no gain.
 */
export function flowNodeType(kind: NodeKind): 'architecture' | 'comment' | 'scope' | 'tree' {
  if (kind === 'comment') return 'comment';
  if (kind === 'group') return 'scope';
  if (kind === 'tree') return 'tree';
  return 'architecture';
}

/** Projects the visible nodes of one diagram into React Flow nodes, in the order given. */
export function projectNodes(input: ProjectionInput): Node<ArchitectureNodeData>[] {
  const { editable, preferences, record, select, selection, view } = input;
  const connected = connectedIds(input);
  const byId: Record<string, NestedNode> = Object.fromEntries(
    view.nodes.map((node) => [node.id as string, node]),
  );
  // Dimming is a relationship between what is selected and what is drawn. A selection that
  // reaches nothing on screen — the object was undone away, or its kind is hidden — has no
  // relationship to show, so the canvas stays lit rather than greying out entirely.
  const dimming = preferences.wires.dimUnrelated && selection !== null
    && view.nodes.some((node) => connected.has(node.id as string));
  // `view.nodes` is parent-first by contract, so React Flow always meets a parent before its
  // child; this projection must not reorder it.
  return view.nodes.map((node) => {
    // A parent hidden by kind policy leaves its children visible; React Flow throws on a
    // parentId it cannot resolve, so an unresolvable parent is dropped rather than passed on.
    const parentId = node.parentId && byId[node.parentId] ? node.parentId as string : undefined;
    return {
      id: node.id as string,
      type: flowNodeType(node.kind),
      position: node.position,
      parentId,
      // Deliberately no `extent: 'parent'`. A group carries meaning; it is not a wall. Clamping
      // a node to its container made membership a cage the user had to argue with — you could
      // not drag a module out of the frame it was born in. Where a node may go is now the whole
      // canvas, and where it belongs is decided on drop, by where it landed.
      width: node.size.width,
      height: node.size.height,
      selected: selection?.kind === 'node' && selection.id === node.id,
      className: dimming && !connected.has(node.id) && node.kind !== 'group' ? 'is-dimmed' : '',
      // A group is a frame, not a surface: its whole box is click-through, and only the parts
      // that mean something — the title, the ports, the resize handles — opt back in
      // (`canvas.css`). React Flow's own `.react-flow__node.draggable` rule sets
      // `pointer-events: all` at a specificity a stylesheet cannot politely outrank, so the
      // policy is declared here, where the rest of a group's interaction policy already lives.
      // Without it the root group covers the diagram and swallows every click meant for the
      // pane — the reason clicking empty space used to select the enclosing group.
      style: node.kind === 'group' ? { pointerEvents: 'none' as const } : undefined,
      // A selected group rises above the interaction layers so its resize handles are reachable.
      // Otherwise a group sits behind regular nodes by nesting depth, so a parent container
      // stays behind the ones it holds.
      zIndex: node.kind === 'group'
        ? (selection?.kind === 'node' && selection.id === node.id ? 4 : scopeDepth(byId, node) - 1)
        : node.kind === 'comment' ? 3 : 2,
      data: {
        node,
        interfaces: node.interfaceIds.flatMap((id) => record.interfaces[id] ? [record.interfaces[id]] : []),
        types: node.typeIds.flatMap((id) => record.types[id] ? [record.types[id]] : []),
        preferences,
        selection,
        editable,
        select,
      },
    };
  });
}

/** Projects the visible wires of one diagram into React Flow edges. */
export function projectEdges(input: ProjectionInput): Edge<ArchitectureEdgeData>[] {
  const { editable, preferences, select, selection, view } = input;
  const connected = connectedIds(input);
  return view.wires.map((wire) => ({
    id: wire.id,
    source: wire.source.nodeId,
    target: wire.target.nodeId,
    type: 'elbow',
    selected: selection?.kind === 'wire' && selection.id === wire.id,
    zIndex: selection?.kind === 'wire' && selection.id === wire.id ? 1000 : 0,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: wireKindColor(wire.kind, preferences.appearance.theme),
      width: 14,
      height: 14,
    },
    className: preferences.wires.dimUnrelated && selection
      && (!connected.has(wire.source.nodeId) || !connected.has(wire.target.nodeId)) ? 'is-dimmed' : '',
    data: {
      label: wire.label,
      kind: wire.kind,
      preferences,
      editable,
      select: () => select({ kind: 'wire', id: wire.id }),
    },
  }));
}
