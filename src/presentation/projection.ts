import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { RecordCommand } from '../application/canvas-workspace';
import type { CanvasPreferences, InterfaceObject, Selection, TypeObject } from '../domain/model';
import type { PositionedNode, ProjectedView } from '../domain/project-view';
import type { DiagramRecord, NodeKind, PortSide, WireKind } from '../domain/records';
import { componentFor } from '../components/registry';
import { ARCHITECTURE_FLOW } from '../domain/flow';
import { wireKindColor } from './wire-styles';
import { routeWire, type Rect, type RouteObstacle, type RouteSide } from './edges/wire-routing';
import { resolveNodeAppearance, type ResolvedNodeAppearance } from '../domain/canvas-presentation';

/** Presentation data required by architecture nodes. */
export interface ArchitectureNodeData extends Record<string, unknown> {
  node: PositionedNode;
  /** Renames the node from the canvas itself; absent on a read-only host. */
  rename?: (id: string, label: string) => void;
  /** A resize gesture ended; absent on a read-only host. */
  resizeEnd?: (id: string) => void;
  interfaces: InterfaceObject[];
  types: TypeObject[];
  preferences: CanvasPreferences;
  selection: Selection;
  editable: boolean;
  select: (selection: Selection) => void;
  appearance: ResolvedNodeAppearance;
}

/** How one wire is shaped by hand, read from the active layout's route hint. */
export interface EdgeRoute {
  waypoints: { x: number; y: number }[];
  /** 0 at the source, 1 at the target; absent means "wherever the router puts it". */
  labelPosition?: number;
}

/** Presentation data required by elbow wires. */
export interface ArchitectureEdgeData extends Record<string, unknown> {
  label: string;
  kind: WireKind;
  preferences: CanvasPreferences;
  editable: boolean;
  select: () => void;
  /** The stored shape of this wire; empty when nobody has touched it. */
  route: EdgeRoute;
  /** Rectangles this wire is unrelated to and must route around. */
  obstacles: RouteObstacle[];
  /**
   * Shaping this wire, or absent when the host gave the projection no way to change anything.
   *
   * Optional so a read-only host — an SVG snapshot, a test harness — can project the same wires
   * without pretending to own a workspace.
   */
  setRoute?: (route: Partial<EdgeRoute>) => void;
  /**
   * Re-attaches one end of this wire to a node, and to a side of it.
   *
   * Separate from `setRoute` because it changes what the wire means, not how it is drawn: the
   * node is a fact of the record, the side a fact of the layout. Optional for the same reason
   * as `setRoute` — a read-only host projects wires without owning a workspace.
   */
  moveEnd?: (end: 'source' | 'target', nodeId: string, side?: string) => void;
  /**
   * Signed perpendicular offset that keeps wires sharing a node pair apart.
   *
   * Assigned here rather than in the renderer because separation is a property of the whole set
   * of wires, and an edge component only ever sees itself.
   */
  lane: number;
}

/** Distance between the corridors of two wires that join the same pair of nodes. */
const LANE_GAP = 22;

/**
 * Which sides two nodes should face each other across.
 *
 * `ARCHITECTURE_FLOW` names one pair — bottom out, top in — and using it for every wire is why
 * so many routes were detours: a target sitting to the left had to be left from the bottom and
 * entered from the top, so the only way there was around. The direction between the two boxes
 * decides instead, which is what every other diagram tool does and what makes the ordinary case
 * a plain two-turn elbow.
 *
 * Overlap decides the axis before distance does. Two boxes stacked in the same column are
 * "above and below" even when their centres differ more horizontally than vertically, and
 * joining their sides would send the wire out and back around. A stored `preferredSide` still
 * wins over all of this — this is only what to do when nobody has said.
 */
export function facingSides(
  source: Rect,
  target: Rect,
): { sourceSide: PortSide; targetSide: PortSide } {
  const spans = (aLow: number, aHigh: number, bLow: number, bHigh: number): number =>
    Math.min(aHigh, bHigh) - Math.max(aLow, bLow);
  const overlapX = spans(source.x, source.x + source.width, target.x, target.x + target.width);
  const overlapY = spans(source.y, source.y + source.height, target.y, target.y + target.height);
  const dx = (target.x + target.width / 2) - (source.x + source.width / 2);
  const dy = (target.y + target.height / 2) - (source.y + source.height / 2);

  const vertical = overlapX > 0 && overlapY <= 0 ? true
    : overlapY > 0 && overlapX <= 0 ? false
      : Math.abs(dy) >= Math.abs(dx);

  if (vertical) {
    return dy >= 0
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' };
  }
  return dx >= 0
    ? { sourceSide: 'right', targetSide: 'left' }
    : { sourceSide: 'left', targetSide: 'right' };
}

/** Where a wire meets a rectangle on a given side. */
function attachmentPoint(rect: Rect, side: PortSide): { x: number; y: number } {
  if (side === 'top') return { x: rect.x + rect.width / 2, y: rect.y };
  if (side === 'bottom') return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  if (side === 'left') return { x: rect.x, y: rect.y + rect.height / 2 };
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
}

/**
 * The sides to actually use: the ones the boxes face across, unless that route crosses something.
 *
 * Choosing sides purely by direction is right for the ordinary case and wrong for the long ones —
 * on Chris's Command Overview three wires span most of the diagram, and the facing pair sends
 * them through a node the vertical pair clears. So the choice belongs inside the search rather
 * than ahead of it: try the natural pair first, fall back through the others, and take the first
 * that crosses nothing. The facing pair stands when none of them is clean, because then the
 * crossing is a property of the layout rather than of the side.
 */
export function chooseSides(
  source: Rect,
  target: Rect,
  obstacles: RouteObstacle[],
): { sourceSide: PortSide; targetSide: PortSide } {
  const facing = facingSides(source, target);
  const alternatives: Array<{ sourceSide: PortSide; targetSide: PortSide }> = [
    facing,
    { sourceSide: 'bottom', targetSide: 'top' },
    { sourceSide: 'top', targetSide: 'bottom' },
    { sourceSide: 'right', targetSide: 'left' },
    { sourceSide: 'left', targetSide: 'right' },
  ];
  for (const pair of alternatives) {
    const route = routeWire({
      source: attachmentPoint(source, pair.sourceSide),
      sourceSide: pair.sourceSide as RouteSide,
      target: attachmentPoint(target, pair.targetSide),
      targetSide: pair.targetSide as RouteSide,
      obstacles,
    });
    if (route.collisions === 0) return pair;
  }
  return facing;
}

/**
 * Every visible node's rectangle in diagram coordinates.
 *
 * Placements are stored relative to a parent, and the router thinks in absolute space, so the
 * parent chain is folded in once here rather than by each caller.
 */
export function nodeRects(view: ProjectedView): Map<string, Rect> {
  const byId = new Map(view.nodes.map((node) => [node.id as string, node]));
  const rects = new Map<string, Rect>();
  for (const node of view.nodes) {
    let x = node.position.x;
    let y = node.position.y;
    let cursor = node.parentId as string | undefined;
    const seen = new Set<string>([node.id as string]);
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const parent = byId.get(cursor) as PositionedNode;
      x += parent.position.x;
      y += parent.position.y;
      cursor = parent.parentId as string | undefined;
    }
    rects.set(node.id as string, { x, y, width: node.size.width, height: node.size.height });
  }
  return rects;
}

/** Every node on the parent chain above one node, itself included. */
function ancestryOf(byId: Map<string, PositionedNode>, id: string): Set<string> {
  const chain = new Set<string>([id]);
  let cursor = byId.get(id)?.parentId as string | undefined;
  while (cursor && byId.has(cursor) && !chain.has(cursor)) {
    chain.add(cursor);
    cursor = byId.get(cursor)?.parentId as string | undefined;
  }
  return chain;
}

/**
 * What one wire must not cross.
 *
 * Its own two ends are excluded, and so is everything on their parent chains and everything
 * inside them: a wire leaving a group has to cross that group's frame, and a wire arriving at a
 * group cannot avoid the things the group contains. Frames of unrelated groups are soft — a
 * relationship that spans two groups has to cross a frame to exist at all — while an unrelated
 * node body is the thing Chris called a massive problem, and is never acceptable.
 */
export function wireObstacles(
  view: ProjectedView,
  rects: Map<string, Rect>,
  wire: { source: { nodeId: string }; target: { nodeId: string } },
): RouteObstacle[] {
  const byId = new Map(view.nodes.map((node) => [node.id as string, node]));
  const related = new Set<string>([
    ...ancestryOf(byId, wire.source.nodeId),
    ...ancestryOf(byId, wire.target.nodeId),
  ]);
  const others = view.nodes.flatMap((node) => {
    const id = node.id as string;
    if (related.has(id)) return [];
    // Anything inside one of the ends is as unavoidable as the end itself. Only the two ends
    // count here: their ancestors contain the whole diagram, which would excuse everything.
    const ancestry = ancestryOf(byId, id);
    if (ancestry.has(wire.source.nodeId) || ancestry.has(wire.target.nodeId)) return [];
    const rect = rects.get(id);
    return rect ? [{ rect, soft: node.kind === 'group' }] : [];
  });

  /*
   * A wire's own two nodes are solid to it as well.
   *
   * Excluding them entirely let the router treat either box as free space and take the short way
   * through it: one real wire left the bottom of CDP control, turned immediately, and climbed
   * back up through the node it had just left to reach a corridor above its target — the hook
   * Chris could not draw. Leaving a port is still free, because collision is measured strictly
   * inside a rectangle and a stub running out from a border anchor only ever touches it.
   *
   * Skipped when one end contains the other: a wire from a group to something inside it has no
   * route that does not enter the group, and scoring that as a fault would reject every
   * candidate equally and leave the choice to noise.
   */
  const sourceAncestry = ancestryOf(byId, wire.source.nodeId);
  const targetAncestry = ancestryOf(byId, wire.target.nodeId);
  const nested = sourceAncestry.has(wire.target.nodeId) || targetAncestry.has(wire.source.nodeId);
  if (nested) return others;
  const ownRects = [wire.source.nodeId, wire.target.nodeId]
    .flatMap((id) => { const rect = rects.get(id); return rect ? [{ rect, soft: false }] : []; });
  return [...others, ...ownRects];
}

/**
 * How far each wire's corridor moves so parallel wires stop drawing over each other.
 *
 * Keyed on the unordered node pair: two wires joining the same two nodes are the ones that would
 * otherwise share every pixel. The middle wire of an odd group keeps the straight route.
 */
function laneOffsets(wires: ProjectedView['wires']): Map<string, number> {
  const groups = new Map<string, string[]>();
  for (const wire of wires) {
    const ends = [wire.source.nodeId as string, wire.target.nodeId as string].sort();
    const key = `${ends[0]}\u0000${ends[1]}`;
    groups.set(key, [...(groups.get(key) ?? []), wire.id]);
  }
  const offsets = new Map<string, number>();
  for (const ids of groups.values()) {
    ids.forEach((id, index) => offsets.set(id, (index - (ids.length - 1) / 2) * LANE_GAP));
  }
  return offsets;
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
  /**
   * The one way this projection changes anything.
   *
   * Optional: a host that only reads — the SVG snapshot, the projection tests — projects the same
   * wires and simply gets no editing affordances, rather than being handed a fake workspace.
   */
  execute?: (command: RecordCommand) => void;
  /** A resize gesture ended; the host commits the accumulated frame as one revision. */
  resizeEnd?: (id: string) => void;
}

/** The minimum a node must expose to be placed in the parent chain. */
interface NestedNode { id: string; parentId?: string }

function selectedOwner(record: DiagramRecord, selection: Selection): string | null {
  if (!selection) return null;
  if (selection.kind === 'node') return selection.id;
  if (selection.kind === 'component-item') {
    const node = record.nodes[selection.nodeId];
    return node && componentFor(node.kind).items?.(node).some(
      (item) => item.collection === selection.collection && item.id === selection.itemId,
    ) ? selection.nodeId : null;
  }
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
 * React Flow node types are now the record kinds themselves — `webRenderers`
 * (`src/components/web-registry.tsx`) is the map from kind to renderer, card kinds included, so
 * this function no longer renames anything.
 */
export function flowNodeType(kind: NodeKind): NodeKind {
  return kind;
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
      // Width and height are layout facts, not incidental DOM measurements. Carrying the same
      // geometry in React Flow's initialized field means replacing the one node under a gesture
      // cannot briefly make its connected edges unrenderable.
      measured: { width: node.size.width, height: node.size.height },
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
        rename: input.execute && editable
          ? (id: string, label: string) => input.execute?.({ kind: 'node.update', id, patch: { label } })
          : undefined,
        resizeEnd: input.resizeEnd && editable ? input.resizeEnd : undefined,
        interfaces: node.interfaceIds.flatMap((id) => record.interfaces[id] ? [record.interfaces[id]] : []),
        types: node.typeIds.flatMap((id) => record.types[id] ? [record.types[id]] : []),
        preferences,
        selection,
        editable,
        select,
        appearance: resolveNodeAppearance(node.kind, node.appearance, {
          theme: preferences.appearance.theme,
          showKinds: preferences.nodes.showKinds,
        }),
      },
    };
  });
}

/** Projects the visible wires of one diagram into React Flow edges. */
export function projectEdges(input: ProjectionInput): Edge<ArchitectureEdgeData>[] {
  const { editable, execute, preferences, record, select, selection, view } = input;
  const connected = connectedIds(input);
  const lanes = laneOffsets(view.wires);
  const hints = record.layouts[record.views[record.activeViewId]?.layoutId]?.wireRouteHints ?? {};
  const rects = nodeRects(view);
  /** Resolved once per wire: side choice needs the obstacle set, and so does the route. */
  const sidesOf = new Map<string, { sourceSide: PortSide; targetSide: PortSide }>();
  const facing = (wire: ProjectedView['wires'][number]) => {
    const cached = sidesOf.get(wire.id as string);
    if (cached) return cached;
    const source = rects.get(wire.source.nodeId as string);
    const target = rects.get(wire.target.nodeId as string);
    const resolved = source && target
      ? chooseSides(source, target, wireObstacles(view, rects, wire))
      : {
        sourceSide: ARCHITECTURE_FLOW.sourcePort as PortSide,
        targetSide: ARCHITECTURE_FLOW.targetPort as PortSide,
      };
    sidesOf.set(wire.id as string, resolved);
    return resolved;
  };
  return view.wires.map((wire) => ({
    id: wire.id,
    source: wire.source.nodeId,
    target: wire.target.nodeId,
    /*
     * The side a wire attaches to is a stored fact, not a constant.
     *
     * These were never set, so React Flow fell back to a node's default port and the elbow
     * renderer — which reads its sides straight off React Flow's resolved positions — redrew
     * every wire on the default sides on every render. Dropping an end on another port looked
     * like it "snapped back"; in truth nothing had ever recorded it. `preferredSourceSide` and
     * `preferredTargetSide` have existed in the schema the whole time with no reader and no
     * writer. Naming the handle here is what gives them a reader.
     */
    sourceHandle: hints[wire.id]?.preferredSourceSide ?? facing(wire).sourceSide,
    targetHandle: hints[wire.id]?.preferredTargetSide ?? facing(wire).targetSide,
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
      lane: lanes.get(wire.id) ?? 0,
      route: {
        waypoints: hints[wire.id]?.waypoints ?? [],
        labelPosition: hints[wire.id]?.labelPosition,
      },
      /*
       * Turning avoidance off is a preference, not a bug.
       *
       * `avoidNodes` off hands the router an empty obstacle set, which is exactly what it used
       * to receive by accident. On is the default and the standard the routing gate enforces
       * over every real diagram; off exists for anyone who wants the shortest line and will
       * place their own corridors.
       */
      obstacles: (preferences.wires.avoidNodes ?? true) ? wireObstacles(view, rects, wire) : [],
      setRoute: execute && editable
        ? (route: Partial<EdgeRoute>) => execute({ kind: 'wire.setRoute', id: wire.id, route })
        : undefined,
      moveEnd: execute && editable
        ? (end: 'source' | 'target', nodeId: string, side?: string) => {
          const isSide = side === 'top' || side === 'right' || side === 'bottom' || side === 'left';
          execute({
            kind: 'wire.reconnect',
            id: wire.id,
            source: end === 'source' ? nodeId : (wire.source.nodeId as string),
            target: end === 'target' ? nodeId : (wire.target.nodeId as string),
          });
          if (isSide) {
            execute({
              kind: 'wire.setRoute',
              id: wire.id,
              route: end === 'source'
                ? { preferredSourceSide: side }
                : { preferredTargetSide: side },
            });
          }
        }
        : undefined,
    },
  }));
}
