import type { Point, WireRouteRequest } from './contract.ts';
import { ENDPOINT_EGRESS, OBSTACLE_CLEARANCE } from './policy.ts';
import { advance, clamp, isVertical, simplify } from './polyline.ts';

function elbowCandidate(request: WireRouteRequest, corridor: number): Point[] {
  const { source, sourceSide, target, targetSide } = request;
  const stub = request.stub ?? ENDPOINT_EGRESS;
  const sourceOut = advance(source, sourceSide, stub);
  const targetOut = advance(target, targetSide, stub);
  if (isVertical(sourceSide) && isVertical(targetSide)) {
    const y = clamp(corridor, Math.min(sourceOut.y, targetOut.y), Math.max(sourceOut.y, targetOut.y));
    return simplify([source, { x: source.x, y }, { x: target.x, y }, target]);
  }
  if (!isVertical(sourceSide) && !isVertical(targetSide)) {
    const x = clamp(corridor, Math.min(sourceOut.x, targetOut.x), Math.max(sourceOut.x, targetOut.x));
    return simplify([source, { x, y: source.y }, { x, y: target.y }, target]);
  }
  const bend = isVertical(sourceSide)
    ? { x: source.x, y: target.y }
    : { x: target.x, y: source.y };
  return simplify([source, bend, target]);
}

function detourCandidate(
  request: WireRouteRequest,
  corridor: number,
  stubs: { source: number; target: number },
): Point[] {
  const { source, sourceSide, target, targetSide } = request;
  const sourceOut = advance(source, sourceSide, stubs.source);
  const targetOut = advance(target, targetSide, stubs.target);
  if (isVertical(sourceSide) && isVertical(targetSide)) {
    return simplify([
      source, sourceOut,
      { x: corridor, y: sourceOut.y }, { x: corridor, y: targetOut.y },
      targetOut, target,
    ]);
  }
  return simplify([
    source, sourceOut,
    { x: sourceOut.x, y: corridor }, { x: targetOut.x, y: corridor },
    targetOut, target,
  ]);
}

function elbowIsForward(request: WireRouteRequest): boolean {
  const stub = request.stub ?? ENDPOINT_EGRESS;
  const sourceOut = advance(request.source, request.sourceSide, stub);
  const targetOut = advance(request.target, request.targetSide, stub);
  if (isVertical(request.sourceSide) && isVertical(request.targetSide)) {
    return request.sourceSide === 'bottom'
      ? targetOut.y >= sourceOut.y : targetOut.y <= sourceOut.y;
  }
  if (!isVertical(request.sourceSide) && !isVertical(request.targetSide)) {
    return request.sourceSide === 'right'
      ? targetOut.x >= sourceOut.x : targetOut.x <= sourceOut.x;
  }
  return true;
}

function corridorCandidates(request: WireRouteRequest, axis: 'x' | 'y'): number[] {
  const stub = request.stub ?? ENDPOINT_EGRESS;
  const lane = request.lane ?? 0;
  const sourceOut = advance(request.source, request.sourceSide, stub);
  const targetOut = advance(request.target, request.targetSide, stub);
  const middle = (sourceOut[axis] + targetOut[axis]) / 2 + lane;
  const values = [middle];
  for (const obstacle of request.obstacles ?? []) {
    const low = axis === 'x' ? obstacle.rect.x : obstacle.rect.y;
    const high = axis === 'x'
      ? obstacle.rect.x + obstacle.rect.width : obstacle.rect.y + obstacle.rect.height;
    values.push(low - OBSTACLE_CLEARANCE + lane, high + OBSTACLE_CLEARANCE + lane);
  }
  return [...new Set(values)].sort((left, right) =>
    Math.abs(left - middle) - Math.abs(right - middle) || left - right);
}

function detourCandidates(request: WireRouteRequest, axis: 'x' | 'y'): number[] {
  const lane = request.lane ?? 0;
  const from = request.source[axis];
  const to = request.target[axis];
  const spans = (request.obstacles ?? []).map((obstacle) => obstacle.rect);
  const lows = spans.map((rect) => (axis === 'x' ? rect.x : rect.y));
  const highs = spans.map((rect) => (axis === 'x' ? rect.x + rect.width : rect.y + rect.height));
  const near = [
    Math.min(from, to) - OBSTACLE_CLEARANCE * 2 + lane,
    Math.max(from, to) + OBSTACLE_CLEARANCE * 2 + lane,
    ...lows.map((low) => low - OBSTACLE_CLEARANCE + lane),
    ...highs.map((high) => high + OBSTACLE_CLEARANCE + lane),
  ];
  const middle = (from + to) / 2;
  const sorted = [...new Set(near)].sort((left, right) =>
    Math.abs(left - middle) - Math.abs(right - middle) || left - right);
  return [
    ...sorted.slice(0, 12),
    Math.min(from, to, ...lows) - OBSTACLE_CLEARANCE * 2 + lane,
    Math.max(from, to, ...highs) + OBSTACLE_CLEARANCE * 2 + lane,
  ];
}

function clearingStub(request: WireRouteRequest, axis: 'x' | 'y'): number {
  const obstacles = request.obstacles ?? [];
  if (obstacles.length === 0) return ENDPOINT_EGRESS;
  const edges = obstacles.map((obstacle) => (axis === 'y'
    ? [obstacle.rect.y, obstacle.rect.y + obstacle.rect.height]
    : [obstacle.rect.x, obstacle.rect.x + obstacle.rect.width])).flat();
  const from = request.source[axis];
  const outward = request.sourceSide === 'bottom' || request.sourceSide === 'right'
    ? Math.max(...edges) - from : from - Math.min(...edges);
  return Math.max(ENDPOINT_EGRESS, outward + OBSTACLE_CLEARANCE * 2);
}

/** Bounded candidate family; selection and scoring remain the router's responsibility. */
export function routeCandidates(request: WireRouteRequest): Point[][] {
  const axis = isVertical(request.sourceSide) ? 'y' : 'x';
  const detourAxis = axis === 'y' ? 'x' : 'y';
  const candidates: Point[][] = [];
  if (elbowIsForward(request)) {
    for (const corridor of corridorCandidates(request, axis).slice(0, 24)) {
      candidates.push(elbowCandidate(request, corridor));
    }
  }
  const escape = clearingStub(request, axis);
  const stubs = [request.stub ?? ENDPOINT_EGRESS, 56, 110, escape];
  for (const source of stubs) {
    for (const target of stubs) {
      for (const corridor of detourCandidates(request, detourAxis)) {
        candidates.push(detourCandidate(request, corridor, { source, target }));
      }
    }
  }
  return candidates;
}
