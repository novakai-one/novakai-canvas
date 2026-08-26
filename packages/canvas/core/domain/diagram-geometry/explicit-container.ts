import type { ContainerArrangement } from '../../../contract/schemas/presentation.ts';
import type { Size } from '../../../contract/records/legacy.ts';
import type { ResolvedContainerArrangement } from './arrangement.ts';
import { layoutEqualColumnGrid } from './explicit-grid.ts';
import {
  alignedOffset, enclosingSize, rectanglesOverlap, type Rect,
} from './geometry.ts';
import { minimumConnectionSeparation } from './policy.ts';
import type { LayoutNestedContainer, LayoutState } from './state.ts';

function childRect(state: LayoutState, nodeId: string): Rect {
  const child = state.document.nodes[nodeId];
  return { x: child.position.x, y: child.position.y, ...child.size };
}

function prepareChildren(
  state: LayoutState,
  childIds: readonly string[],
  layoutNested: LayoutNestedContainer,
): void {
  for (const id of childIds) {
    if (state.isPinned(id)) continue;
    const child = state.document.nodes[id];
    const size = child.kind === 'scope' ? layoutNested(id) : state.measureNode(id);
    state.document.nodes[id] = { ...child, size };
  }
}

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

function layoutAxis(
  state: LayoutState,
  childIds: readonly string[],
  arrangement: ResolvedContainerArrangement,
): Size {
  const paddingTop = state.groupPadding + 16;
  const stack = arrangement.layout === 'stack';
  const crossStart = stack ? state.groupPadding : paddingTop;
  const minimumCross = stack
    ? 320 - state.groupPadding * 2
    : 160 - paddingTop - state.groupPadding;
  const crossExtent = crossExtentFor(state, childIds, stack, crossStart, minimumCross);
  const pinned = childIds.filter((id) => state.isPinned(id)).map((id) => childRect(state, id));
  let cursor = stack ? paddingTop : state.groupPadding;

  for (const id of childIds) {
    if (state.isPinned(id)) continue;
    const child = state.document.nodes[id];
    const size = arrangement.align === 'stretch'
      ? (stack ? { ...child.size, width: crossExtent } : { ...child.size, height: crossExtent })
      : child.size;
    const cross = alignedOffset(
      crossStart, crossExtent, stack ? size.width : size.height, arrangement.align,
    );
    const initial = stack
      ? { x: cross, y: cursor, width: size.width, height: size.height }
      : { x: cursor, y: cross, width: size.width, height: size.height };
    const candidate = nextUnblockedPosition(initial, pinned, stack ? 'y' : 'x', arrangement.gap);
    state.document.nodes[id] = {
      ...child, position: { x: candidate.x, y: candidate.y }, size,
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

/** Source-ordered arrangement whose authored gap is a minimum when siblings are connected. */
export function layoutExplicitContainer(
  state: LayoutState,
  containerId: string,
  authored: ContainerArrangement,
  layoutNested: LayoutNestedContainer,
): Size {
  const childIds = authored.childIds.filter((id) =>
    state.document.nodes[id]?.parentId === containerId);
  prepareChildren(state, childIds, layoutNested);
  const arrangement: ResolvedContainerArrangement = state.hasInternalWire(childIds)
    ? { ...authored, gap: Math.max(authored.gap, minimumConnectionSeparation()) }
    : authored;
  return arrangement.layout === 'grid'
    ? layoutEqualColumnGrid(state, childIds, arrangement)
    : layoutAxis(state, childIds, arrangement);
}
