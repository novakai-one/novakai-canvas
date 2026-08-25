/**
 * The pin pass. A container's existing placement runs verbatim first; then children
 * declaring a band or lane are moved to their declared coordinates and the container
 * is re-enclosed. Nothing declared, nothing moves — an undeclared diagram lays out
 * byte-identically to one built before topology existed.
 */

import type { NodeId } from '../ids.ts';
import type { Size } from '../model.ts';
import { enclosingSize, rectanglesOverlap, type Rect } from './geometry.ts';
import type { LayoutState } from './state.ts';

/** Along-axis gap between dense ranks; matches the grid row gap of automatic containers. */
const RANK_GAP = 70;
/** Along-axis gap between two nodes stacked in one band+lane cell. */
const STACK_GAP = 16;

interface Pin {
  id: string;
  band?: number;
  lane?: number;
  isZone: boolean;
}

/** The frame a zone inherits from its direct children: a uniform band, and its lane span. */
function zoneFrame(state: LayoutState, zoneId: string): { band?: number; minLane?: number } {
  let band: number | undefined;
  let bandUniform = true;
  let minLane: number | undefined;
  for (const [id, node] of Object.entries(state.document.nodes)) {
    if (node.parentId !== zoneId) continue;
    const childBand = state.topology.bands.get(id as NodeId);
    const childLane = state.topology.lanes.get(id as NodeId);
    if (childBand === undefined) bandUniform = false;
    else if (band !== undefined && band !== childBand) bandUniform = false;
    else band = childBand;
    if (childLane !== undefined) minLane = Math.min(minLane ?? childLane, childLane);
  }
  return {
    ...(bandUniform && band !== undefined ? { band } : {}),
    ...(minLane === undefined ? {} : { minLane }),
  };
}

function pinsOf(state: LayoutState, childIds: readonly string[]): Pin[] {
  const pins: Pin[] = [];
  for (const id of childIds) {
    const isZone = state.document.nodes[id].kind === 'scope';
    if (isZone) {
      const frame = zoneFrame(state, id);
      if (frame.band === undefined && frame.minLane === undefined) continue;
      pins.push({ id, band: frame.band, lane: frame.minLane, isZone: true });
      continue;
    }
    const band = state.topology.bands.get(id as NodeId);
    const lane = state.topology.lanes.get(id as NodeId);
    if (band === undefined && lane === undefined) continue;
    pins.push({ id, band, lane, isZone: false });
  }
  return pins;
}

function rectOf(state: LayoutState, nodeId: string): Rect {
  const node = state.document.nodes[nodeId];
  return { x: node.position.x, y: node.position.y, ...node.size };
}

function placeAt(state: LayoutState, nodeId: string, coordinate: 'x' | 'y', value: number): void {
  const node = state.document.nodes[nodeId];
  state.document.nodes[nodeId] = { ...node, position: { ...node.position, [coordinate]: value } };
}

function alongSizeOf(state: LayoutState, nodeId: string): number {
  const size = state.document.nodes[nodeId].size;
  return state.axis.along === 'y' ? size.height : size.width;
}

/** Where content starts on one coordinate: x is always padded, y also clears the title. */
function contentOrigin(state: LayoutState, coordinate: 'x' | 'y'): number {
  return coordinate === 'y' ? state.groupPadding + 16 : state.groupPadding;
}

function pinAcross(state: LayoutState, pins: readonly Pin[]): void {
  const laned = pins.filter((pin) => pin.lane !== undefined);
  if (laned.length === 0) return;
  const ruler = state.laneRuler();
  const across = state.axis.across;
  const origin = contentOrigin(state, across);
  const minimum = Math.min(...laned.map((pin) => pin.lane as number));
  for (const pin of laned) {
    const lane = pin.lane as number;
    // A zone's across is its minimum lane's ruler edge: paddings cancel, so its
    // children land on the same ruler coordinates as root-level children.
    const position = pin.isZone
      ? ruler.offsetFor(lane) - ruler.offsetFor(minimum)
      : origin + ruler.offsetFor(lane) - ruler.offsetFor(minimum);
    placeAt(state, pin.id, across, position);
  }
}

function pinBands(state: LayoutState, pins: readonly Pin[], childIds: readonly string[]): void {
  const bands = [...new Set(pins.flatMap((pin) => pin.band === undefined ? [] : [pin.band]))]
    .sort((left, right) => left - right);
  let cursor = contentOrigin(state, state.axis.along);
  for (const band of bands) {
    const row = childIds
      .filter((id) => pins.some((pin) => pin.id === id && pin.band === band))
      .map((id) => pins.find((pin) => pin.id === id) as Pin);
    const stackBottoms = new Map<number | 'float', number>();
    let rankHeight = 0;
    for (const pin of row) {
      const key = pin.lane ?? 'float';
      const top = stackBottoms.get(key) ?? cursor;
      placeAt(state, pin.id, state.axis.along, top);
      const bottom = top + alongSizeOf(state, pin.id) + STACK_GAP;
      stackBottoms.set(key, bottom);
      rankHeight = Math.max(rankHeight, bottom - STACK_GAP - cursor);
    }
    cursor += rankHeight + RANK_GAP;
  }
}

function shiftPastOverlaps(
  state: LayoutState,
  nodeId: string,
  coordinate: 'x' | 'y',
  obstacles: readonly Rect[],
): void {
  let collided = true;
  while (collided) {
    collided = false;
    for (const obstacle of obstacles) {
      if (!rectanglesOverlap(rectOf(state, nodeId), obstacle)) continue;
      const obstacleEnd = coordinate === 'y'
        ? obstacle.y + obstacle.height
        : obstacle.x + obstacle.width;
      placeAt(state, nodeId, coordinate, obstacleEnd + STACK_GAP);
      collided = true;
      break;
    }
  }
}

/** Partially declared and undeclared nodes move only on an unowned dimension when required. */
function resolveOverlaps(state: LayoutState, pins: readonly Pin[], childIds: readonly string[]): void {
  const fixed = pins.filter((pin) => pin.band !== undefined && pin.lane !== undefined);
  const partial = pins.filter((pin) => (pin.band === undefined) !== (pin.lane === undefined));
  const obstacles = fixed.map((pin) => rectOf(state, pin.id));
  for (const pin of partial) {
    const floatingCoordinate = pin.band === undefined ? state.axis.along : state.axis.across;
    shiftPastOverlaps(state, pin.id, floatingCoordinate, obstacles);
    obstacles.push(rectOf(state, pin.id));
  }
  const pinnedIds = new Set(pins.map((pin) => pin.id));
  for (const id of childIds) {
    if (pinnedIds.has(id)) continue;
    shiftPastOverlaps(state, id, state.axis.along, obstacles);
    obstacles.push(rectOf(state, id));
  }
}

/**
 * Moves declared siblings to their pins after the engine has placed them.
 * Returns the re-enclosed container size, or undefined when nothing was declared.
 */
export function placeByTopology(state: LayoutState, childIds: readonly string[]): Size | undefined {
  const pins = pinsOf(state, childIds);
  if (pins.length === 0) return undefined;
  pinAcross(state, pins);
  pinBands(state, pins, childIds);
  resolveOverlaps(state, pins, childIds);
  return enclosingSize(
    childIds.map((id) => rectOf(state, id)),
    state.groupPadding,
    { width: 320, height: 160 },
  );
}

/** Reconciles a container subtree against existing placements, deepest containers first. */
export function reconcileTopology(state: LayoutState, containerId: string): Size | undefined {
  const childIds = state.orderedDirectChildIds(containerId);
  let nestedChanged = false;
  for (const childId of childIds) {
    const child = state.document.nodes[childId];
    if (child.kind !== 'scope') continue;
    const size = reconcileTopology(state, childId);
    if (!size) continue;
    state.document.nodes[childId] = { ...child, size };
    nestedChanged = true;
  }
  const pinnedSize = placeByTopology(state, childIds);
  if (pinnedSize) return pinnedSize;
  if (!nestedChanged) return undefined;
  return enclosingSize(
    childIds.map((id) => rectOf(state, id)),
    state.groupPadding,
    { width: 320, height: 160 },
  );
}
