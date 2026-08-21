/** Reading one diagram record as a graph: geometry, containment, and automatic layout. */

import { layoutScopes, type DiagramRecord } from '../../src/canvas.ts';
// `layoutScopes` still takes the legacy document shape. `documentFor` below is the single
// translation seam, so the CLI depends on the public geometry capability rather than its core.
import type { ArchitectureDocument } from '../../src/domain/model.ts';

// `src/canvas.ts` exports `CanvasNode`, `CanvasWire` and `NodePlacement` from the LEGACY
// document model; the record versions of those three names are not published and would collide
// if they were. Deriving them from `DiagramRecord`, which is published, keeps the CLI on the
// public path without waiting for that naming to be resolved.

/** One semantic node as a diagram record holds it. */
export type RecordNode = DiagramRecord['nodes'][string];

/** One relationship as a diagram record holds it. */
export type RecordWire = DiagramRecord['wires'][string];

/** One node's geometry inside a record's saved layout. */
export type RecordPlacement = DiagramRecord['layouts'][string]['placements'][string];

/** The relationship vocabulary a record's wires carry. */
export type RecordWireKind = RecordWire['kind'];

/** Casts a plain string to a branded id. Ids are opaque; nothing ever parses one for meaning. */
export function asId<T extends string>(value: string): T {
  return value as T;
}

/** A semantic node joined with its geometry in one saved layout. */
export interface PlacedNode extends RecordNode {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** Geometry a node with no saved placement reads as, and the marker layout treats as "new". */
const UNPLACED = { position: { x: 0, y: 0 }, size: { width: 1, height: 1 } };

function activeLayoutId(record: DiagramRecord): string {
  return record.views[record.activeViewId].layoutId as string;
}

/** Every placement in the record's active layout, keyed by node id. */
export function placementsOf(record: DiagramRecord): Record<string, RecordPlacement> {
  return record.layouts[activeLayoutId(record)]?.placements ?? {};
}

/** Joins the record's semantic nodes with the active layout, so callers never re-derive it. */
export function placedNodes(record: DiagramRecord): Record<string, PlacedNode> {
  const placements = placementsOf(record);
  return Object.fromEntries(Object.entries(record.nodes).map(([id, node]) => [id, {
    ...node,
    position: placements[id]?.position ?? { ...UNPLACED.position },
    size: placements[id]?.size ?? { ...UNPLACED.size },
  }]));
}

/**
 * The drawn frame a record's contents hang from.
 *
 * The migration deliberately kept the old scope node as a group rather than dissolving it, so a
 * record normally has exactly one parentless group. `Unfiled` is the exception — it collects
 * nodes that belonged to no diagram — and returns undefined rather than picking one arbitrarily.
 */
export function rootGroupId(record: DiagramRecord): string | undefined {
  const roots = Object.values(record.nodes).filter((node) => !node.parentId && node.kind === 'group');
  return roots.length === 1 ? roots[0].id as string : undefined;
}

/** Every node under a container, breadth-first, excluding the container itself. */
export function descendantIds(record: DiagramRecord, containerId: string): string[] {
  const found: string[] = [];
  const queue = [containerId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const node of Object.values(record.nodes)) {
      if (node.parentId === current) {
        found.push(node.id as string);
        queue.push(node.id as string);
      }
    }
  }
  return found;
}

/** Presents one record in the legacy document shape the canonical layout still reads. */
function documentFor(record: DiagramRecord): ArchitectureDocument {
  const placements = placementsOf(record);
  const layoutId = activeLayoutId(record);
  return {
    schemaVersion: 2,
    id: record.id as string,
    name: record.name,
    revision: record.revision,
    nodes: Object.fromEntries(Object.values(record.nodes).map((node) => [node.id, {
      ...node,
      // The record model renamed `scope` to `group`; layout still speaks the older word.
      kind: node.kind === 'group' ? 'scope' : node.kind,
    }])) as ArchitectureDocument['nodes'],
    interfaces: record.interfaces,
    types: record.types,
    wires: Object.fromEntries(Object.values(record.wires).map((wire) => [wire.id, {
      id: wire.id as string,
      source: wire.source.nodeId as string,
      target: wire.target.nodeId as string,
      label: wire.label,
      kind: wire.kind,
      routing: 'elbow' as const,
    }])),
    activeLayoutId: layoutId,
    layouts: {
      [layoutId]: {
        id: layoutId,
        name: 'Default',
        strategy: 'hierarchy',
        placements: structuredClone(placements) as ArchitectureDocument['layouts'][string]['placements'],
        wireRouteHints: {},
        collapsedNodeIds: [],
        appearanceByNodeId: structuredClone(record.layouts[layoutId].appearanceByNodeId ?? {}),
        appearanceByWireId: structuredClone(record.layouts[layoutId].appearanceByWireId ?? {}),
        arrangementByContainerId: structuredClone(record.layouts[layoutId].arrangementByContainerId ?? {}),
      },
    },
    diagrams: {},
    appliedOperations: {},
  };
}

/**
 * Re-lays out a record's contents from its own content, in place, and returns the new record.
 *
 * Layout is per-record now, which removes the old cross-map overlap problem entirely: two
 * diagrams no longer share one coordinate plane, so a re-applied map can never push another
 * one over. Pinned flags survive; positions are recomputed.
 */
export function layoutRecord(record: DiagramRecord, groupPadding?: number): DiagramRecord {
  const rootId = rootGroupId(record);
  if (!rootId) return record;
  const laidOut = layoutScopes(documentFor(record), [rootId], undefined, groupPadding);
  const layoutId = activeLayoutId(record);
  const previous = placementsOf(record);
  const placements = Object.fromEntries(
    Object.keys(record.nodes).map((nodeId) => {
      const placement = laidOut.layouts[layoutId].placements[nodeId];
      return [nodeId, {
        nodeId,
        position: placement?.position ?? { ...UNPLACED.position },
        size: placement?.size ?? { ...UNPLACED.size },
        ...(previous[nodeId]?.sizeMode ? { sizeMode: previous[nodeId].sizeMode } : {}),
        pinned: previous[nodeId]?.pinned ?? false,
      }];
    }),
  ) as Record<string, RecordPlacement>;
  return {
    ...record,
    layouts: {
      ...record.layouts,
      [layoutId]: { ...record.layouts[layoutId], strategy: 'hierarchy', placements },
    },
  };
}
