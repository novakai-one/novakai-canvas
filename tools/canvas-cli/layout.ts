/** Deterministic auto-layout: agents never write coordinates. */

import dagre from '@dagrejs/dagre';
import type { ArchitectureDocument } from '../../src/domain/model';

const PADDING_TOP = 56;
const PADDING_SIDE = 40;
const PADDING_BOTTOM = 40;
const SCOPE_GAP = 80;
const NEW_SCOPE_X = 40;
const CHAR_WIDTH = 7.2;

interface Size { width: number; height: number }

/**
 * Content-driven card size. Calibrated against the hand-sized cards in the real
 * document (cards render at STORED size with overflow hidden, so estimates bias
 * generous: whitespace is safe, clipping is not).
 */
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

function contentSize(doc: ArchitectureDocument, nodeId: string): Size {
  const node = doc.nodes[nodeId];
  if (node.kind === 'comment') return estimateCommentSize(node.label);
  const interfaceLines = node.interfaceIds.map((id) => {
    const iface = doc.interfaces[id];
    return `${iface.name}(${iface.accepts.join(', ')}) -> ${iface.returns.join(', ')}`;
  });
  const typeLines = node.typeIds.map((id) => {
    const type = doc.types[id];
    return `${type.name} { ${type.fields.join(', ')} }`;
  });
  return estimateNodeSize(node.label, node.description, interfaceLines, typeLines);
}

/**
 * Re-layouts the named scopes' children (dagre TB) and sizes each scope to fit.
 * Re-applied scopes keep their top-left anchor; brand-new scopes (placeholder
 * geometry from the compiler) stack below the lowest existing top-level node.
 * Untouched top-level nodes never move.
 */
export function layoutScopes(input: ArchitectureDocument, scopeIds: string[]): ArchitectureDocument {
  const doc: ArchitectureDocument = {
    ...input,
    nodes: { ...input.nodes },
  };

  const sortedScopeIds = [...scopeIds].sort();
  const newScopeIds: string[] = [];

  for (const scopeId of sortedScopeIds) {
    const scope = doc.nodes[scopeId];
    if (!scope || scope.kind !== 'scope') continue;

    const childIds = Object.keys(doc.nodes)
      .filter((id) => doc.nodes[id].parentId === scopeId)
      .sort();

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70 });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const id of childIds) {
      graph.setNode(id, contentSize(doc, id));
    }
    const childSet = new Set(childIds);
    const edgeIds = Object.keys(doc.wires)
      .filter((id) => childSet.has(doc.wires[id].source) && childSet.has(doc.wires[id].target))
      .sort();
    for (const id of edgeIds) {
      graph.setEdge(doc.wires[id].source, doc.wires[id].target);
    }
    dagre.layout(graph);

    let maxRight = 0;
    let maxBottom = 0;
    for (const id of childIds) {
      const laid = graph.node(id);
      const x = Math.round(laid.x - laid.width / 2) + PADDING_SIDE;
      const y = Math.round(laid.y - laid.height / 2) + PADDING_TOP;
      doc.nodes[id] = {
        ...doc.nodes[id],
        position: { x, y },
        size: { width: laid.width, height: laid.height },
      };
      maxRight = Math.max(maxRight, x + laid.width);
      maxBottom = Math.max(maxBottom, y + laid.height);
    }

    const isNew = scope.size.width === 1 && scope.size.height === 1;
    if (isNew) newScopeIds.push(scopeId);
    doc.nodes[scopeId] = {
      ...scope,
      size: {
        width: Math.max(320, maxRight + PADDING_SIDE),
        height: Math.max(160, maxBottom + PADDING_BOTTOM),
      },
    };
  }

  // Stack brand-new scopes below everything that already has a position.
  for (const scopeId of newScopeIds) {
    let bottom = 0;
    for (const node of Object.values(doc.nodes)) {
      if (node.parentId || node.id === scopeId || newScopeIds.includes(node.id)) continue;
      bottom = Math.max(bottom, node.position.y + node.size.height);
    }
    for (const other of newScopeIds) {
      if (other === scopeId) break;
      bottom = Math.max(bottom, doc.nodes[other].position.y + doc.nodes[other].size.height);
    }
    doc.nodes[scopeId] = {
      ...doc.nodes[scopeId],
      position: { x: NEW_SCOPE_X, y: bottom + SCOPE_GAP },
    };
  }

  return doc;
}

/** True when two placed top-level rectangles overlap (used for the CLI's warning). */
export function overlappingScopes(doc: ArchitectureDocument, scopeId: string): string[] {
  const scope = doc.nodes[scopeId];
  if (!scope) return [];
  return Object.values(doc.nodes)
    .filter((node) => !node.parentId && node.id !== scopeId)
    .filter((node) =>
      scope.position.x < node.position.x + node.size.width &&
      node.position.x < scope.position.x + scope.size.width &&
      scope.position.y < node.position.y + node.size.height &&
      node.position.y < scope.position.y + scope.size.height)
    .map((node) => node.label);
}
