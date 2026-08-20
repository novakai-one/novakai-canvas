/** Pure geometry used to project architecture wires. */

import type { ProjectedView, PositionedNode } from '../../domain/project-view';
import type { PortSide } from '../../domain/records';
import { routeWire, type Rect, type RouteObstacle, type RouteSide } from './wire-routing';

const LANE_GAP = 22;

/** Which sides two nodes naturally face across. */
export function facingSides(
  source: Rect,
  target: Rect,
): { sourceSide: PortSide; targetSide: PortSide } {
  const spans = (aLow: number, aHigh: number, bLow: number, bHigh: number): number =>
    Math.min(aHigh, bHigh) - Math.max(aLow, bLow);
  const overlapX = spans(source.x, source.x + source.width, target.x, target.x + target.width);
  const overlapY = spans(source.y, source.y + source.height, target.y, target.y + target.height);
  const dx = (target.x + target.width / 2) - (source.x + source.width / 2);
  const dy = (target.y + target.height / 2) - (source.y + source.height / 2);
  const vertical = overlapX > 0 && overlapY <= 0 ? true
    : overlapY > 0 && overlapX <= 0 ? false
      : Math.abs(dy) >= Math.abs(dx);
  if (vertical) {
    return dy >= 0
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' };
  }
  return dx >= 0
    ? { sourceSide: 'right', targetSide: 'left' }
    : { sourceSide: 'left', targetSide: 'right' };
}

/** Where a wire meets a rectangle on a given side. */
function attachmentPoint(rect: Rect, side: PortSide): { x: number; y: number } {
  if (side === 'top') return { x: rect.x + rect.width / 2, y: rect.y };
  if (side === 'bottom') return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  if (side === 'left') return { x: rect.x, y: rect.y + rect.height / 2 };
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
}

/** Chooses the natural side pair unless an alternative avoids every obstacle. */
export function chooseSides(
  source: Rect,
  target: Rect,
  obstacles: RouteObstacle[],
): { sourceSide: PortSide; targetSide: PortSide } {
  const facing = facingSides(source, target);
  const alternatives: Array<{ sourceSide: PortSide; targetSide: PortSide }> = [
    facing,
    { sourceSide: 'bottom', targetSide: 'top' },
    { sourceSide: 'top', targetSide: 'bottom' },
    { sourceSide: 'right', targetSide: 'left' },
    { sourceSide: 'left', targetSide: 'right' },
  ];
  for (const pair of alternatives) {
    const route = routeWire({
      source: attachmentPoint(source, pair.sourceSide),
      sourceSide: pair.sourceSide as RouteSide,
      target: attachmentPoint(target, pair.targetSide),
      targetSide: pair.targetSide as RouteSide,
      obstacles,
    });
    if (route.collisions === 0) return pair;
  }
  return facing;
}

/** Every visible node rectangle in absolute diagram coordinates. */
export function nodeRects(view: ProjectedView): Map<string, Rect> {
  const byId = new Map(view.nodes.map((node) => [node.id as string, node]));
  const rects = new Map<string, Rect>();
  for (const node of view.nodes) {
    let x = node.position.x;
    let y = node.position.y;
    let cursor = node.parentId as string | undefined;
    const seen = new Set<string>([node.id as string]);
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const parent = byId.get(cursor) as PositionedNode;
      x += parent.position.x;
      y += parent.position.y;
      cursor = parent.parentId as string | undefined;
    }
    rects.set(node.id as string, { x, y, width: node.size.width, height: node.size.height });
  }
  return rects;
}

function ancestryOf(byId: Map<string, PositionedNode>, id: string): Set<string> {
  const chain = new Set<string>([id]);
  let cursor = byId.get(id)?.parentId as string | undefined;
  while (cursor && byId.has(cursor) && !chain.has(cursor)) {
    chain.add(cursor);
    cursor = byId.get(cursor)?.parentId as string | undefined;
  }
  return chain;
}

/** Rectangles one wire must not cross. */
export function wireObstacles(
  view: ProjectedView,
  rects: Map<string, Rect>,
  wire: { source: { nodeId: string }; target: { nodeId: string } },
): RouteObstacle[] {
  const byId = new Map(view.nodes.map((node) => [node.id as string, node]));
  const related = new Set<string>([
    ...ancestryOf(byId, wire.source.nodeId),
    ...ancestryOf(byId, wire.target.nodeId),
  ]);
  const others = view.nodes.flatMap((node) => {
    const id = node.id as string;
    if (related.has(id)) return [];
    const ancestry = ancestryOf(byId, id);
    if (ancestry.has(wire.source.nodeId) || ancestry.has(wire.target.nodeId)) return [];
    const rect = rects.get(id);
    return rect ? [{ rect, soft: node.kind === 'group' }] : [];
  });
  const sourceAncestry = ancestryOf(byId, wire.source.nodeId);
  const targetAncestry = ancestryOf(byId, wire.target.nodeId);
  const nested = sourceAncestry.has(wire.target.nodeId) || targetAncestry.has(wire.source.nodeId);
  if (nested) return others;
  const ownRects = [wire.source.nodeId, wire.target.nodeId]
    .flatMap((id) => { const rect = rects.get(id); return rect ? [{ rect, soft: false }] : []; });
  return [...others, ...ownRects];
}

/** Assigns parallel wires distinct corridor offsets. */
export function laneOffsets(wires: ProjectedView['wires']): Map<string, number> {
  const groups = new Map<string, string[]>();
  for (const wire of wires) {
    const ends = [wire.source.nodeId as string, wire.target.nodeId as string].sort();
    const key = `${ends[0]}\u0000${ends[1]}`;
    groups.set(key, [...(groups.get(key) ?? []), wire.id]);
  }
  const offsets = new Map<string, number>();
  for (const ids of groups.values()) {
    ids.forEach((id, index) => offsets.set(id, (index - (ids.length - 1) / 2) * LANE_GAP));
  }
  return offsets;
}
