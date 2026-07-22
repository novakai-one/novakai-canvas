/** Deterministic, content-driven layout shared by every canvas adapter. */

import dagre from '@dagrejs/dagre';
import { ARCHITECTURE_FLOW } from './flow.ts';
import type { ArchitectureDocument, TreeRow } from './model.ts';
import { orderedTreeRows, treeRowDepth, treeRowText } from './tree.ts';

const PADDING_TOP = 56;
const PADDING_SIDE = 40;
const PADDING_BOTTOM = 40;
const SCOPE_GAP = 80;
const NEW_SCOPE_X = 40;
const CHAR_WIDTH = 7.2;
const GRID_COL_GAP = 40;
const GRID_ROW_GAP = 70;
/** Widest row the zone grid packs before wrapping; keeps aspect ratio bounded. */
const GRID_MAX_ROW_WIDTH = 2000;

interface Size { width: number; height: number }

/** Generous stored size that prevents presentation adapters clipping content. */
export function estimateNodeSize(
  label: string,
  description: string | undefined,
  interfaceLines: string[],
  typeLines: string[],
): Size {
  const longestLine = Math.max(
    label.length,
    ...interfaceLines.map((line) => line.length),
    ...typeLines.map((line) => line.length),
    description ? Math.min(description.length, 55) : 0,
  );
  const width = Math.min(420, Math.max(200, Math.round(24 + CHAR_WIDTH * longestLine)));
  const charsPerLine = Math.max(30, Math.floor(width / CHAR_WIDTH));
  const descriptionBlock = description ? 24 + 16 * Math.ceil(description.length / charsPerLine) : 0;
  const height = 48 + descriptionBlock + 26 * interfaceLines.length + 24 * typeLines.length + 16;
  return { width, height };
}

function estimateCommentSize(label: string): Size {
  return { width: 280, height: 48 + 21 * Math.ceil(label.length / 34) };
}

function estimateTreeSize(rows: TreeRow[]): Size {
  const ordered = orderedTreeRows(rows);
  const longest = Math.max(0, ...ordered.map(
    (row) => treeRowDepth(rows, row) * 20 + treeRowText(row).length * 7.6,
  ));
  return {
    width: Math.min(640, Math.max(280, Math.round(36 + longest))),
    height: 56 + ordered.length * 24 + 14,
  };
}

function contentSize(document: ArchitectureDocument, nodeId: string): Size {
  const node = document.nodes[nodeId];
  if (node.kind === 'comment') return estimateCommentSize(node.label);
  if (node.kind === 'tree') return estimateTreeSize(node.rows ?? []);
  const interfaceLines = node.interfaceIds.map((id) => {
    const item = document.interfaces[id];
    return `${item.name}(${item.accepts.join(', ')}) -> ${item.returns.join(', ')}`;
  });
  const typeLines = node.typeIds.map((id) => {
    const item = document.types[id];
    return `${item.name} { ${item.fields.join(', ')} }`;
  });
  return estimateNodeSize(node.label, node.description, interfaceLines, typeLines);
}

function directChildren(document: ArchitectureDocument, containerId: string): string[] {
  return Object.keys(document.nodes)
    .filter((id) => document.nodes[id].parentId === containerId)
    .sort();
}

/** Flat container: dagre over children with every child-internal wire as a rank edge. */
function layoutFlat(document: ArchitectureDocument, childIds: string[]): Size {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: ARCHITECTURE_FLOW.rankDirection, nodesep: 40, ranksep: 70 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const id of childIds) graph.setNode(id, contentSize(document, id));
  const childSet = new Set(childIds);
  const edgeIds = Object.keys(document.wires)
    .filter((id) => childSet.has(document.wires[id].source) && childSet.has(document.wires[id].target))
    .sort();
  for (const id of edgeIds) graph.setEdge(document.wires[id].source, document.wires[id].target);
  dagre.layout(graph);

  let maxRight = 0;
  let maxBottom = 0;
  for (const id of childIds) {
    const laid = graph.node(id);
    const x = Math.round(laid.x - laid.width / 2) + PADDING_SIDE;
    const y = Math.round(laid.y - laid.height / 2) + PADDING_TOP;
    document.nodes[id] = {
      ...document.nodes[id],
      position: { x, y },
      size: { width: laid.width, height: laid.height },
    };
    maxRight = Math.max(maxRight, x + laid.width);
    maxBottom = Math.max(maxBottom, y + laid.height);
  }
  return {
    width: Math.max(320, maxRight + PADDING_SIDE),
    height: Math.max(160, maxBottom + PADDING_BOTTOM),
  };
}

/** Topological rank by `owns` among siblings; cycles break deterministically by id. */
function ownsRanks(document: ArchitectureDocument, childIds: string[]): Map<string, number> {
  const childSet = new Set(childIds);
  const targetsBySource = new Map<string, string[]>();
  const indegree = new Map<string, number>(childIds.map((id) => [id, 0]));
  for (const wire of Object.values(document.wires)) {
    if (wire.kind !== 'owns' || !childSet.has(wire.source) || !childSet.has(wire.target)) continue;
    if (wire.source === wire.target) continue;
    targetsBySource.set(wire.source, [...(targetsBySource.get(wire.source) ?? []), wire.target]);
    indegree.set(wire.target, (indegree.get(wire.target) ?? 0) + 1);
  }
  const ranks = new Map<string, number>();
  let frontier = childIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  let rank = 0;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      ranks.set(id, rank);
      for (const target of targetsBySource.get(id) ?? []) {
        const remaining = (indegree.get(target) ?? 0) - 1;
        indegree.set(target, remaining);
        if (remaining === 0) next.push(target);
      }
    }
    frontier = next;
    rank += 1;
  }
  for (const id of childIds) if (!ranks.has(id)) ranks.set(id, rank);
  return ranks;
}

/** Zoned container: deterministic grid packing with topological rank by `owns` (ruling R6). */
function layoutGrid(document: ArchitectureDocument, childIds: string[]): Size {
  for (const id of childIds) {
    if (document.nodes[id].kind === 'scope') continue; // zones already sized by the recursion
    document.nodes[id] = { ...document.nodes[id], size: contentSize(document, id) };
  }
  const ranks = ownsRanks(document, childIds);
  const byRank = new Map<number, string[]>();
  for (const id of childIds) {
    const rank = ranks.get(id) ?? 0;
    byRank.set(rank, [...(byRank.get(rank) ?? []), id]);
  }

  let y = PADDING_TOP;
  let maxRight = 0;
  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    // Wrap wide ranks into multiple rows so the grid keeps a bounded aspect ratio.
    const rows: string[][] = [[]];
    let rowWidth = 0;
    for (const id of byRank.get(rank) as string[]) {
      const width = document.nodes[id].size.width;
      const current = rows[rows.length - 1];
      if (current.length > 0 && rowWidth + GRID_COL_GAP + width > GRID_MAX_ROW_WIDTH) {
        rows.push([]);
        rowWidth = 0;
      }
      rows[rows.length - 1].push(id);
      rowWidth = rowWidth === 0 ? width : rowWidth + GRID_COL_GAP + width;
    }
    for (const row of rows) {
      let x = PADDING_SIDE;
      let rowHeight = 0;
      for (const id of row) {
        const size = document.nodes[id].size;
        document.nodes[id] = { ...document.nodes[id], position: { x, y } };
        x += size.width + GRID_COL_GAP;
        rowHeight = Math.max(rowHeight, size.height);
        maxRight = Math.max(maxRight, x - GRID_COL_GAP);
      }
      y += rowHeight + GRID_ROW_GAP;
    }
  }
  const maxBottom = y - GRID_ROW_GAP;
  return {
    width: Math.max(320, maxRight + PADDING_SIDE),
    height: Math.max(160, maxBottom + PADDING_BOTTOM),
  };
}

/** Lays out one container; recurses into child zones bottom-up before packing it. */
function layoutContainer(document: ArchitectureDocument, containerId: string): Size {
  const childIds = directChildren(document, containerId);
  const zoneIds = childIds.filter((id) => document.nodes[id].kind === 'scope');
  if (zoneIds.length === 0) return layoutFlat(document, childIds);
  for (const zoneId of zoneIds) {
    const size = layoutContainer(document, zoneId);
    document.nodes[zoneId] = { ...document.nodes[zoneId], size };
  }
  return layoutGrid(document, childIds);
}

/** Re-layouts named scopes without moving unrelated top-level maps. */
export function layoutScopes(input: ArchitectureDocument, scopeIds: string[]): ArchitectureDocument {
  const document: ArchitectureDocument = { ...input, nodes: { ...input.nodes } };
  const sortedScopeIds = [...scopeIds].sort();
  const newScopeIds: string[] = [];

  for (const scopeId of sortedScopeIds) {
    const scope = document.nodes[scopeId];
    if (!scope || scope.kind !== 'scope') continue;
    const isNew = scope.size.width === 1 && scope.size.height === 1;
    if (isNew) newScopeIds.push(scopeId);
    const size = layoutContainer(document, scopeId);
    document.nodes[scopeId] = { ...document.nodes[scopeId], size };
  }

  for (const scopeId of newScopeIds) {
    let bottom = 0;
    for (const node of Object.values(document.nodes)) {
      if (node.parentId || node.id === scopeId || newScopeIds.includes(node.id)) continue;
      bottom = Math.max(bottom, node.position.y + node.size.height);
    }
    for (const other of newScopeIds) {
      if (other === scopeId) break;
      bottom = Math.max(bottom, document.nodes[other].position.y + document.nodes[other].size.height);
    }
    document.nodes[scopeId] = {
      ...document.nodes[scopeId],
      position: { x: NEW_SCOPE_X, y: bottom + SCOPE_GAP },
    };
  }

  return document;
}

/** Names top-level maps that now overlap a laid-out scope. */
export function overlappingScopes(document: ArchitectureDocument, scopeId: string): string[] {
  const scope = document.nodes[scopeId];
  if (!scope) return [];
  return Object.values(document.nodes)
    .filter((node) => !node.parentId && node.id !== scopeId)
    .filter((node) =>
      scope.position.x < node.position.x + node.size.width
      && node.position.x < scope.position.x + scope.size.width
      && scope.position.y < node.position.y + node.size.height
      && node.position.y < scope.position.y + scope.size.height)
    .map((node) => node.label);
}
