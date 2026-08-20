import type { ContainerArrangement } from '../canvas-presentation.ts';
import type { Size } from '../model.ts';
import {
  alignedOffset, enclosingSize, rectanglesOverlap, type Rect,
} from './geometry.ts';
import {
  type LayoutNestedContainer, type LayoutState,
} from './state.ts';

function childRect(state: LayoutState, nodeId: string): Rect {
  const child = state.document.nodes[nodeId];
  return { x: child.position.x, y: child.position.y, ...child.size };
}

/** Measures leaves and recursively sizes unpinned nested containers. */
function prepareExplicitChildren(
  state: LayoutState,
  childIds: readonly string[],
  layoutNested: LayoutNestedContainer,
): void {
  for (const id of childIds) {
    if (state.isPinned(id)) continue;
    const child = state.document.nodes[id];
    const size = child.kind === 'scope' ? layoutNested(id) : state.measureNode(id);
    state.document.nodes[id] = { ...state.document.nodes[id], size };
  }
}

interface GridCursor {
  cell: number;
  rowTop: number;
  rowHeight: number;
  rowHasChild: boolean;
}

function nextGridPosition(
  state: LayoutState,
  size: Size,
  arrangement: ContainerArrangement,
  cellWidth: number,
  obstacles: readonly Rect[],
  cursor: GridCursor,
): Rect {
  while (true) {
    const column = cursor.cell % (arrangement.columns ?? 1);
    if (cursor.cell > 0 && column === 0) {
      cursor.rowTop += (cursor.rowHasChild ? cursor.rowHeight : Math.max(1, size.height))
        + arrangement.gap;
      cursor.rowHeight = 0;
      cursor.rowHasChild = false;
    }
    const cellLeft = state.groupPadding + column * (cellWidth + arrangement.gap);
    const x = alignedOffset(cellLeft, cellWidth, size.width, arrangement.align);
    const candidate = { x, y: cursor.rowTop, width: size.width, height: size.height };
    cursor.cell += 1;
    if (!obstacles.some((obstacle) => rectanglesOverlap(candidate, obstacle))) return candidate;
  }
}

/** Moves a candidate forward on one axis until it clears every pinned obstacle. */
function nextUnblockedPosition(
  initial: Rect,
  obstacles: readonly Rect[],
  axis: 'x' | 'y',
  gap: number,
): Rect {
  let candidate = initial;
  let collision = obstacles.find((obstacle) => rectanglesOverlap(candidate, obstacle));
  while (collision) {
    candidate = axis === 'y'
      ? { ...candidate, y: collision.y + collision.height + gap }
      : { ...candidate, x: collision.x + collision.width + gap };
    collision = obstacles.find((obstacle) => rectanglesOverlap(candidate, obstacle));
  }
  return candidate;
}

/** Equal-width, row-major grid with pinned rectangles treated as occupied cells. */
function layoutEqualColumnGrid(
  state: LayoutState,
  childIds: readonly string[],
  arrangement: ContainerArrangement,
): Size {
  const columns = arrangement.columns ?? 1;
  const paddingTop = state.groupPadding + 16;
  const cellWidth = Math.max(1, ...childIds.map((id) => state.document.nodes[id].size.width));
  const pinnedObstacles = childIds.filter((id) => state.isPinned(id))
    .map((id) => childRect(state, id));
  const cursor: GridCursor = { cell: 0, rowTop: paddingTop, rowHeight: 0, rowHasChild: false };

  for (const id of childIds) {
    if (state.isPinned(id)) continue;
    const child = state.document.nodes[id];
    const size = arrangement.align === 'stretch'
      ? { ...child.size, width: cellWidth }
      : child.size;
    const candidate = nextGridPosition(
      state, size, arrangement, cellWidth, pinnedObstacles, cursor,
    );
    state.document.nodes[id] = {
      ...child,
      position: { x: candidate.x, y: candidate.y },
      size,
    };
    cursor.rowHeight = Math.max(cursor.rowHeight, size.height);
    cursor.rowHasChild = true;
  }

  const minimumWidth = state.groupPadding * 2
    + columns * cellWidth
    + (columns - 1) * arrangement.gap;
  return enclosingSize(
    childIds.map((id) => childRect(state, id)),
    state.groupPadding,
    { width: Math.max(320, minimumWidth), height: 160 },
  );
}

function crossExtentFor(
  state: LayoutState,
  childIds: readonly string[],
  stack: boolean,
  crossStart: number,
  minimum: number,
): number {
  let extent = minimum;
  for (const id of childIds) {
    const child = state.document.nodes[id];
    const size = stack ? child.size.width : child.size.height;
    const start = stack ? child.position.x : child.position.y;
    extent = Math.max(extent, state.isPinned(id) ? start + size - crossStart : size);
  }
  return extent;
}

function stretchedSize(
  size: Size,
  stack: boolean,
  align: ContainerArrangement['align'],
  crossExtent: number,
): Size {
  if (align !== 'stretch') return size;
  return stack ? { ...size, width: crossExtent } : { ...size, height: crossExtent };
}

function axisRect(stack: boolean, cursor: number, cross: number, size: Size): Rect {
  return stack
    ? { x: cross, y: cursor, width: size.width, height: size.height }
    : { x: cursor, y: cross, width: size.width, height: size.height };
}

/** Stack or row arrangement with one main-axis cursor and one cross-axis alignment rule. */
function layoutAxis(
  state: LayoutState,
  childIds: readonly string[],
  arrangement: ContainerArrangement,
): Size {
  const paddingTop = state.groupPadding + 16;
  const stack = arrangement.layout === 'stack';
  const crossStart = stack ? state.groupPadding : paddingTop;
  const minimumCross = stack
    ? 320 - state.groupPadding * 2
    : 160 - paddingTop - state.groupPadding;
  const crossExtent = crossExtentFor(state, childIds, stack, crossStart, minimumCross);

  const pinnedObstacles = childIds.filter((id) => state.isPinned(id))
    .map((id) => childRect(state, id));
  let cursor = stack ? paddingTop : state.groupPadding;
  for (const id of childIds) {
    if (state.isPinned(id)) continue;
    const child = state.document.nodes[id];
    const size = stretchedSize(child.size, stack, arrangement.align, crossExtent);
    const cross = alignedOffset(
      crossStart,
      crossExtent,
      stack ? size.width : size.height,
      arrangement.align,
    );
    const initial = axisRect(stack, cursor, cross, size);
    const candidate = nextUnblockedPosition(
      initial,
      pinnedObstacles,
      stack ? 'y' : 'x',
      arrangement.gap,
    );
    state.document.nodes[id] = {
      ...child,
      position: { x: candidate.x, y: candidate.y },
      size,
    };
    cursor = (stack ? candidate.y + candidate.height : candidate.x + candidate.width)
      + arrangement.gap;
  }

  return enclosingSize(
    childIds.map((id) => childRect(state, id)),
    state.groupPadding,
    { width: 320, height: 160 },
  );
}

/** The sole private path for every authored container arrangement. */
export function layoutExplicitContainer(
  state: LayoutState,
  containerId: string,
  arrangement: ContainerArrangement,
  layoutNested: LayoutNestedContainer,
): Size {
  const childIds = arrangement.childIds.filter((id) =>
    state.document.nodes[id]?.parentId === containerId);
  prepareExplicitChildren(state, childIds, layoutNested);
  return arrangement.layout === 'grid'
    ? layoutEqualColumnGrid(state, childIds, arrangement)
    : layoutAxis(state, childIds, arrangement);
}
