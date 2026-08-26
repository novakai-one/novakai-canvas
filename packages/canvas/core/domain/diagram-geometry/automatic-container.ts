import dagre from '@dagrejs/dagre';
import type { Size } from '../../../contract/records/legacy.ts';
import { enclosingSize, type Rect } from './geometry.ts';
import { placeByTopology } from './lane-edges.ts';
import { minimumConnectionSeparation } from './policy.ts';
import type { LayoutNestedContainer, LayoutState } from './state.ts';

const GRID_COL_GAP = 40;
const GRID_ROW_GAP = 70;
const GRID_MAX_ROW_WIDTH = 2000;

function childRect(state: LayoutState, nodeId: string): Rect {
  const child = state.document.nodes[nodeId];
  return { x: child.position.x, y: child.position.y, ...child.size };
}

/** Dagre layout for a container whose children are all leaves. */
function layoutDagreChildren(state: LayoutState, childIds: readonly string[]): Size {
  const paddingTop = state.groupPadding + 16;
  const graph = new dagre.graphlib.Graph();
  const ranksep = state.hasInternalWire(childIds)
    ? Math.max(GRID_ROW_GAP, minimumConnectionSeparation()) : GRID_ROW_GAP;
  graph.setGraph({ rankdir: state.axis.rankDirection, nodesep: GRID_COL_GAP, ranksep });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const id of childIds) graph.setNode(id, state.measureNode(id));
  const childSet = new Set(childIds);
  const edgeIds = Object.keys(state.document.wires)
    .filter((id) => childSet.has(state.document.wires[id].source)
      && childSet.has(state.document.wires[id].target))
    .sort();
  for (const id of edgeIds) {
    graph.setEdge(state.document.wires[id].source, state.document.wires[id].target);
  }
  dagre.layout(graph);

  for (const id of childIds) {
    const laid = graph.node(id);
    state.document.nodes[id] = {
      ...state.document.nodes[id],
      position: {
        x: Math.round(laid.x - laid.width / 2) + state.groupPadding,
        y: Math.round(laid.y - laid.height / 2) + paddingTop,
      },
      size: { width: laid.width, height: laid.height },
    };
  }
  return enclosingSize(
    childIds.map((id) => childRect(state, id)),
    state.groupPadding,
    { width: 320, height: 160 },
  );
}

function ownershipEdges(
  state: LayoutState,
  childIds: readonly string[],
): { targetsBySource: Map<string, string[]>; indegree: Map<string, number> } {
  const childSet = new Set(childIds);
  const targetsBySource = new Map<string, string[]>();
  const indegree = new Map<string, number>(childIds.map((id) => [id, 0]));
  for (const wire of Object.values(state.document.wires)) {
    if (wire.kind !== 'owns' || !childSet.has(wire.source) || !childSet.has(wire.target)) continue;
    if (wire.source === wire.target) continue;
    targetsBySource.set(wire.source, [...(targetsBySource.get(wire.source) ?? []), wire.target]);
    indegree.set(wire.target, (indegree.get(wire.target) ?? 0) + 1);
  }
  return { targetsBySource, indegree };
}

function rankChildrenByOwnership(
  state: LayoutState,
  childIds: readonly string[],
): ReadonlyMap<string, number> {
  const { targetsBySource, indegree } = ownershipEdges(state, childIds);
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

function rowsForRank(state: LayoutState, childIds: readonly string[]): string[][] {
  const rows: string[][] = [[]];
  let rowWidth = 0;
  for (const id of childIds) {
    const width = state.document.nodes[id].size.width;
    const current = rows[rows.length - 1];
    if (current.length > 0 && rowWidth + GRID_COL_GAP + width > GRID_MAX_ROW_WIDTH) {
      rows.push([]);
      rowWidth = 0;
    }
    rows[rows.length - 1].push(id);
    rowWidth = rowWidth === 0 ? width : rowWidth + GRID_COL_GAP + width;
  }
  return rows;
}

function placeRows(
  state: LayoutState,
  rows: readonly string[][],
  startY: number,
  rowGap: number,
): number {
  let y = startY;
  for (const row of rows) {
    let x = state.groupPadding;
    let rowHeight = 0;
    for (const id of row) {
      const child = state.document.nodes[id];
      state.document.nodes[id] = { ...child, position: { x, y } };
      x += child.size.width + GRID_COL_GAP;
      rowHeight = Math.max(rowHeight, child.size.height);
    }
    y += rowHeight + rowGap;
  }
  return y;
}

/** Ownership-ranked grid for a container containing one or more nested zones. */
function layoutRankedChildren(state: LayoutState, childIds: readonly string[]): Size {
  for (const id of childIds) {
    if (state.document.nodes[id].kind === 'scope') continue;
    state.document.nodes[id] = { ...state.document.nodes[id], size: state.measureNode(id) };
  }
  const ranks = rankChildrenByOwnership(state, childIds);
  const byRank = new Map<number, string[]>();
  for (const id of childIds) {
    const rank = ranks.get(id) ?? 0;
    byRank.set(rank, [...(byRank.get(rank) ?? []), id]);
  }

  const rowGap = state.hasInternalWire(childIds)
    ? Math.max(GRID_ROW_GAP, minimumConnectionSeparation()) : GRID_ROW_GAP;
  let y = state.groupPadding + 16;
  for (const rank of [...byRank.keys()].sort((left, right) => left - right)) {
    y = placeRows(state, rowsForRank(state, byRank.get(rank) as string[]), y, rowGap);
  }
  return enclosingSize(
    childIds.map((id) => childRect(state, id)),
    state.groupPadding,
    { width: 320, height: 160 },
  );
}

export function layoutAutomaticContainer(
  state: LayoutState,
  containerId: string,
  layoutNested: LayoutNestedContainer,
): Size {
  const childIds = state.orderedDirectChildIds(containerId);
  const zoneIds = childIds.filter((id) => state.document.nodes[id].kind === 'scope');
  if (zoneIds.length === 0) {
    const size = layoutDagreChildren(state, childIds);
    // The pin pass runs after the engine has placed every child; nothing declared, nothing moves.
    return placeByTopology(state, childIds) ?? size;
  }
  for (const zoneId of zoneIds) {
    const size = layoutNested(zoneId);
    if (!state.isPinned(zoneId)) {
      state.document.nodes[zoneId] = { ...state.document.nodes[zoneId], size };
    }
  }
  const size = layoutRankedChildren(state, childIds);
  return placeByTopology(state, childIds) ?? size;
}
