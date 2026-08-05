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

/**
 * Grows a hidden set downwards until it is closed under containment.
 *
 * A node is drawn inside its container, so a child whose container is not drawn has nowhere to
 * be. Leaving it in would also break the parents-before-children contract below: the renderer
 * would be handed a child naming a parent that never arrives.
 */
function hideContainedNodes(record: DiagramRecord, hidden: Set<string>): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(record.nodes)) {
      if (node.parentId && hidden.has(node.parentId) && !hidden.has(node.id)) {
        hidden.add(node.id);
        changed = true;
      }
    }
  }
}

function depthOf(record: DiagramRecord, nodeId: string): number {
  let depth = 0;
  let cursor = record.nodes[nodeId]?.parentId as string | undefined;
  while (cursor) {
    depth += 1;
    cursor = record.nodes[cursor]?.parentId as string | undefined;
  }
  return depth;
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
  const hidden = new Set<string>();
  for (const node of Object.values(record.nodes)) {
    // A collapsed group keeps its own box and hides what is inside it; a hidden kind takes its
    // own nodes away entirely. Containment then carries both decisions down the tree.
    if (hiddenKinds.has(node.kind)) hidden.add(node.id);
    else if (node.parentId && collapsed.has(node.parentId)) hidden.add(node.id);
  }
  hideContainedNodes(record, hidden);

  const visible = Object.values(record.nodes).filter((node) => !hidden.has(node.id));
  const nodes: PositionedNode[] = visible
    .map((node) => {
      const placement = layout.placements[node.id];
      return {
        ...node,
        position: placement?.position ?? { x: 0, y: 0 },
        size: placement?.size ?? { width: 1, height: 1 },
        pinned: placement?.pinned ?? false,
      };
    })
    // Parents before children, then by id so the order never depends on object insertion.
    .sort((left, right) => depthOf(record, left.id) - depthOf(record, right.id)
      || left.id.localeCompare(right.id));

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
