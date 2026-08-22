/** Projects visible architecture nodes and re-exports wire projection. */

import type { Node } from '@xyflow/react';
import type { CanvasPreferences, InterfaceObject, Selection, TypeObject } from '../domain/model';
import type { PositionedNode } from '../domain/project-view';
import type { NodeKind } from '../domain/records';
import { resolveNodeAppearance, type ResolvedNodeAppearance } from '../domain/canvas-presentation';
import type { ProjectionInput } from './projection-contract';
import { connectedIds } from './projection-selection';

/** Presentation data required by architecture nodes. */
export interface ArchitectureNodeData extends Record<string, unknown> {
  node: PositionedNode;
  rename?: (id: string, label: string) => void;
  resizeEnd?: (id: string) => void;
  interfaces: InterfaceObject[];
  types: TypeObject[];
  preferences: CanvasPreferences;
  selection: Selection;
  editable: boolean;
  select: (selection: Selection) => void;
  appearance: ResolvedNodeAppearance;
}

interface NestedNode { id: string; parentId?: string }

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

/** Registry kinds are the React Flow node types. */
export function flowNodeType(kind: NodeKind): NodeKind {
  return kind;
}

/** Projects the visible nodes of one diagram into React Flow nodes, in source order. */
export function projectNodes(input: ProjectionInput): Node<ArchitectureNodeData>[] {
  const { editable, preferences, record, select, selection, view } = input;
  const connected = connectedIds(input);
  const byId: Record<string, NestedNode> = Object.fromEntries(
    view.nodes.map((node) => [node.id as string, node]),
  );
  const dimming = preferences.wires.dimUnrelated && selection !== null
    && view.nodes.some((node) => connected.has(node.id as string));
  return view.nodes.map((node) => {
    const parentId = node.parentId && byId[node.parentId] ? node.parentId as string : undefined;
    return {
      id: node.id as string,
      type: flowNodeType(node.kind),
      position: node.position,
      parentId,
      width: node.size.width,
      height: node.size.height,
      measured: { width: node.size.width, height: node.size.height },
      selected: selection?.kind === 'node' && selection.id === node.id,
      className: dimming && !connected.has(node.id) && node.kind !== 'group' ? 'is-dimmed' : '',
      style: node.kind === 'group' ? { pointerEvents: 'none' as const } : undefined,
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

export type { ProjectionInput } from './projection-contract';
export { projectEdges } from './edges/wire-projection';
export type { ArchitectureEdgeData, EdgeRoute } from './edges/wire-projection';
export { chooseSides, facingSides, nodeRects, wireObstacles } from '../domain/diagram-geometry';
