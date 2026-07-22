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

/** Re-layouts named scopes without moving unrelated top-level maps. */
export function layoutScopes(input: ArchitectureDocument, scopeIds: string[]): ArchitectureDocument {
  const document: ArchitectureDocument = { ...input, nodes: { ...input.nodes } };
  const sortedScopeIds = [...scopeIds].sort();
  const newScopeIds: string[] = [];

  for (const scopeId of sortedScopeIds) {
    const scope = document.nodes[scopeId];
    if (!scope || scope.kind !== 'scope') continue;
    const childIds = Object.keys(document.nodes)
      .filter((id) => document.nodes[id].parentId === scopeId)
      .sort();
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

    const isNew = scope.size.width === 1 && scope.size.height === 1;
    if (isNew) newScopeIds.push(scopeId);
    document.nodes[scopeId] = {
      ...scope,
      size: {
        width: Math.max(320, maxRight + PADDING_SIDE),
        height: Math.max(160, maxBottom + PADDING_BOTTOM),
      },
    };
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
