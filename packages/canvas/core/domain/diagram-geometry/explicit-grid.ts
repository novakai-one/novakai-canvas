import type { Size } from '../../../contract/records/legacy.ts';
import type { ResolvedContainerArrangement } from './arrangement.ts';
import {
  alignedOffset, enclosingSize, rectanglesOverlap, type Rect,
} from './geometry.ts';
import type { LayoutState } from './state.ts';

interface GridCursor {
  cell: number;
  rowTop: number;
  rowHeight: number;
  rowHasChild: boolean;
}

function childRect(state: LayoutState, nodeId: string): Rect {
  const child = state.document.nodes[nodeId];
  return { x: child.position.x, y: child.position.y, ...child.size };
}

function nextGridPosition(
  state: LayoutState,
  size: Size,
  arrangement: ResolvedContainerArrangement,
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

/** Equal-width, row-major grid with pinned rectangles treated as occupied cells. */
export function layoutEqualColumnGrid(
  state: LayoutState,
  childIds: readonly string[],
  arrangement: ResolvedContainerArrangement,
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
