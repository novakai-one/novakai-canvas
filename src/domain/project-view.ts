import type { NodeId, ViewId } from './ids.ts';
import type {
  CanvasNode, CanvasWire, DiagramRecord, NodeKind, NodePlacement,
} from './records.ts';

/**
 * The frozen contract between the domain lane and the rendering lane.
 *
 * Types are fixed here by the lead before either lane starts, so a builder implementing the
 * projection and a builder consuming it can work at the same time without waiting on each
 * other. Only the lead changes this file.
 */

/** A semantic node joined with its geometry in the active layout. */
export interface PositionedNode extends CanvasNode {
  position: NodePlacement['position'];
  size: NodePlacement['size'];
  pinned: boolean;
}

/**
 * Everything a renderer needs from one diagram, with visibility policy already applied.
 *
 * Hosts do not decide what is visible: collapse and kind-hiding are resolved once, here, so the
 * browser, the CLI's SVG snapshot, and any future host cannot drift into showing different
 * things for the same saved view.
 */
export interface ProjectedView {
  /**
   * Visible nodes, ordered parents-before-children.
   *
   * The ordering is part of the contract because renderers that support nesting require a
   * parent to exist before its child is added.
   */
  nodes: PositionedNode[];
  /** Visible wires. A wire whose endpoint is hidden is excluded rather than left dangling. */
  wires: CanvasWire[];
  /** The saved viewport of the projected view. */
  viewport: { x: number; y: number; zoom: number };
  /** Groups currently collapsed, so a host can render the affordance to expand them. */
  collapsedNodeIds: NodeId[];
  /** Kinds hidden by this view, for the same reason. */
  hiddenKinds: NodeKind[];
}

/** True when any strict ancestor of the node is collapsed — folded content stays folded. */
function underCollapsedAncestor(record: DiagramRecord, nodeId: string, collapsed: Set<string>): boolean {
  let cursor = record.nodes[nodeId]?.parentId as string | undefined;
  while (cursor) {
    if (collapsed.has(cursor)) return true;
    cursor = record.nodes[cursor]?.parentId as string | undefined;
  }
  return false;
}

/**
 * Where a node lands when ancestors of a hidden kind are skipped over.
 *
 * Hiding a kind removes those nodes' boxes, not the things drawn inside them: a child is
 * re-parented to its nearest still-visible ancestor, and because placements are stored relative
 * to the parent, every skipped ancestor's offset is folded into the child's position so it does
 * not move on screen.
 */
function promotedPlacement(
  record: DiagramRecord,
  layout: DiagramRecord['layouts'][string],
  node: CanvasNode,
  hiddenKinds: Set<string>,
): { parentId: NodeId | undefined; offset: { x: number; y: number }; depth: number } {
  const offset = { x: 0, y: 0 };
  let cursor = node.parentId as string | undefined;
  let depth = 0;
  let parentId: NodeId | undefined;
  while (cursor) {
    const ancestor = record.nodes[cursor];
    if (!ancestor) break;
    if (hiddenKinds.has(ancestor.kind)) {
      const position = layout.placements[cursor]?.position ?? { x: 0, y: 0 };
      offset.x += position.x;
      offset.y += position.y;
    } else {
      parentId ??= ancestor.id;
      depth += 1;
    }
    cursor = ancestor.parentId as string | undefined;
  }
  return { parentId, offset, depth };
}

/**
 * Projects one diagram record for rendering.
 *
 * Pure and deterministic: no clock, no randomness, no I/O. The same record and view always
 * produce a deep-equal result, which is what makes a rendered diagram reproducible.
 *
 * @param record the diagram to project
 * @param viewId which saved view to use; defaults to the record's active view
 */
export function projectView(record: DiagramRecord, viewId?: ViewId): ProjectedView {
  const view = record.views[viewId ?? record.activeViewId];
  if (!view) throw new Error(`unknown-view:${viewId ?? record.activeViewId}`);
  const layout = record.layouts[view.layoutId];
  if (!layout) throw new Error(`unknown-layout:${view.layoutId}`);

  const hiddenKinds = new Set<string>(view.hiddenKinds);
  const collapsed = new Set<string>(view.collapsedNodeIds);

  // Two different visibility rules, on purpose. Collapse folds a group's contents away, so it
  // hides every descendant. Hiding a kind removes only those nodes' own boxes: their children
  // are promoted to the nearest visible ancestor, because hiding (say) the group frames of a
  // diagram must not blank the modules drawn inside them.
  const visible = Object.values(record.nodes).filter((node) =>
    !hiddenKinds.has(node.kind) && !underCollapsedAncestor(record, node.id, collapsed));

  const nodes: PositionedNode[] = visible
    .map((node) => {
      const placement = layout.placements[node.id];
      const promoted = promotedPlacement(record, layout, node, hiddenKinds);
      const position = placement?.position ?? { x: 0, y: 0 };
      return {
        node: {
          ...node,
          parentId: promoted.parentId,
          position: { x: position.x + promoted.offset.x, y: position.y + promoted.offset.y },
          size: placement?.size ?? { width: 1, height: 1 },
          pinned: placement?.pinned ?? false,
        },
        depth: promoted.depth,
      };
    })
    // Parents before children, then by id so the order never depends on object insertion.
    .sort((left, right) => left.depth - right.depth
      || left.node.id.localeCompare(right.node.id))
    .map((entry) => entry.node);

  const visibleIds = new Set(nodes.map((node) => node.id as string));
  const wires = Object.values(record.wires)
    .filter((wire) => visibleIds.has(wire.source.nodeId) && visibleIds.has(wire.target.nodeId))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    nodes,
    wires,
    viewport: { ...view.viewport },
    collapsedNodeIds: [...view.collapsedNodeIds],
    hiddenKinds: [...view.hiddenKinds],
  };
}
