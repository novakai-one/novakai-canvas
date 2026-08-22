import dagre from '@dagrejs/dagre';
import type {
  ArchitectureDocument, LayoutProposal, LayoutRequest, NodePlacement,
} from './legacy-document.ts';
import { layoutScopes } from './diagram-geometry.ts';
import { placementFor, resolveLayout } from './layouts.ts';

function uniqueExistingNodeIds(document: ArchitectureDocument, nodeIds: string[]): string[] {
  return [...new Set(nodeIds)].filter((id) => document.nodes[id]).sort();
}

function descendantIds(document: ArchitectureDocument, rootId: string): string[] {
  const ids = [rootId];
  for (let index = 0; index < ids.length; index += 1) {
    const parentId = ids[index];
    for (const node of Object.values(document.nodes)) {
      if (node.parentId === parentId && !ids.includes(node.id)) ids.push(node.id);
    }
  }
  return ids.sort();
}

function layoutNamedNodes(
  document: ArchitectureDocument,
  nodeIds: string[],
  layoutId: string,
): Record<string, NodePlacement> {
  const ids = uniqueExistingNodeIds(document, nodeIds);
  if (ids.length === 0) return {};
  const parentIds = new Set(ids.map((id) => document.nodes[id].parentId ?? null));
  if (parentIds.size !== 1) throw new Error('layout-target-mixed-parents');

  const original = Object.fromEntries(ids.map((id) => [id, placementFor(document, id, layoutId)]));
  const movableIds = ids.filter((id) => !original[id].pinned);
  if (movableIds.length < 2) return original;

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const id of movableIds) graph.setNode(id, original[id].size);
  const movable = new Set(movableIds);
  for (const wire of Object.values(document.wires).sort((a, b) => a.id.localeCompare(b.id))) {
    if (movable.has(wire.source) && movable.has(wire.target)) graph.setEdge(wire.source, wire.target);
  }
  dagre.layout(graph);

  const anchorX = Math.min(...movableIds.map((id) => original[id].position.x));
  const anchorY = Math.min(...movableIds.map((id) => original[id].position.y));
  const graphX = Math.min(...movableIds.map((id) => {
    const node = graph.node(id);
    return node.x - node.width / 2;
  }));
  const graphY = Math.min(...movableIds.map((id) => {
    const node = graph.node(id);
    return node.y - node.height / 2;
  }));

  return Object.fromEntries(ids.map((id) => {
    if (original[id].pinned) return [id, original[id]];
    const node = graph.node(id);
    return [id, {
      ...original[id],
      position: {
        x: Math.round(anchorX + node.x - node.width / 2 - graphX),
        y: Math.round(anchorY + node.y - node.height / 2 - graphY),
      },
    }];
  }));
}

/** Calculates deterministic geometry without mutating or revising the document. */
export function previewLayout(
  document: ArchitectureDocument,
  request: LayoutRequest,
): LayoutProposal {
  const layout = resolveLayout(document, request.layoutId);
  let affectedNodeIds: string[];
  let placements: Record<string, NodePlacement>;

  if (request.target.kind === 'scope') {
    affectedNodeIds = descendantIds(document, request.target.scopeId);
    const candidate = layoutScopes(
      document,
      [request.target.scopeId],
      layout.id,
      request.groupPadding,
    );
    placements = Object.fromEntries(affectedNodeIds.map((id) => {
      const original = placementFor(document, id, layout.id);
      return [id, original.pinned ? original : placementFor(candidate, id, layout.id)];
    }));
  } else {
    affectedNodeIds = uniqueExistingNodeIds(document, request.target.nodeIds);
    placements = layoutNamedNodes(document, affectedNodeIds, layout.id);
  }

  return {
    baseRevision: document.revision,
    layoutId: layout.id,
    target: request.target,
    affectedNodeIds,
    placements,
  };
}

/** Applies a preview only when it still targets the current document revision. */
export function applyLayoutProposal(
  document: ArchitectureDocument,
  proposal: LayoutProposal,
): ArchitectureDocument {
  if (document.revision !== proposal.baseRevision) throw new Error('stale-layout-proposal');
  const layout = resolveLayout(document, proposal.layoutId);
  return {
    ...document,
    layouts: {
      ...document.layouts,
      [layout.id]: {
        ...layout,
        placements: { ...layout.placements, ...structuredClone(proposal.placements) },
      },
    },
  };
}
