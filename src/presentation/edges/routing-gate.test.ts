import { describe, expect, it } from 'vitest';
import { diagramRecordSchema, projectView } from '../../canvas';
import type { DiagramRecord } from '../../canvas';
import { chooseSides, nodeRects, wireObstacles } from '../projection';
import { routeCollisions, routeWire, type Rect, type RouteSide } from './wire-routing';

/**
 * The routing gate.
 *
 * Chris's words: "Wires travel through nodes that they aren't related to -> Massive problem."
 * This measures exactly that, on his real diagrams, through the same functions the browser
 * renders with — not on a fixture that could be shaped until it passed.
 */

/** The real migrated diagrams, loaded the way every other real-data test loads them. */
const records: Array<[string, DiagramRecord]> = Object.entries(
  import.meta.glob('../../../public/data/diagrams/*.json', {
    query: '?raw', import: 'default', eager: true,
  }) as Record<string, string>,
)
  .map(([path, raw]): [string, DiagramRecord] => [
    path.slice(path.lastIndexOf('/') + 1),
    diagramRecordSchema.parse(JSON.parse(raw)),
  ])
  .sort(([left], [right]) => left.localeCompare(right));

/*
 * The sides the application actually draws with.
 *
 * This used to pin ARCHITECTURE_FLOW's fixed bottom/top pair while `projectEdges` chose sides
 * from geometry — the same shape of mistake as routing without obstacles: a gate measuring a
 * route nobody renders. It asks the projection now, so the two cannot drift apart again.
 */
const sidesFor = (
  source: Rect, target: Rect, obstacles: ReturnType<typeof wireObstacles>,
): { sourceSide: RouteSide; targetSide: RouteSide } => {
  const sides = chooseSides(source, target, obstacles);
  return { sourceSide: sides.sourceSide as RouteSide, targetSide: sides.targetSide as RouteSide };
};

function attachment(rect: Rect, side: RouteSide): { x: number; y: number } {
  if (side === 'top') return { x: rect.x + rect.width / 2, y: rect.y };
  if (side === 'bottom') return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  if (side === 'left') return { x: rect.x, y: rect.y + rect.height / 2 };
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
}

interface Audit {
  wires: number;
  /** Unrelated node bodies the routed wires cross. The number that has to be nought. */
  crossings: number;
  /** Group frames crossed — allowed, because a wire between two groups must cross one. */
  frameCrossings: number;
  /** What a straight line between the same two ports would have crossed. */
  straightCrossings: number;
  offenders: string[];
}

/** Routes every wire of one diagram and reports what those routes cross. */
function auditDiagram(record: DiagramRecord): Audit {
  const view = projectView(record);
  const rects = nodeRects(view);
  const audit: Audit = {
    wires: view.wires.length, crossings: 0, frameCrossings: 0, straightCrossings: 0, offenders: [],
  };
  for (const wire of view.wires) {
    const source = rects.get(wire.source.nodeId as string);
    const target = rects.get(wire.target.nodeId as string);
    if (!source || !target) continue;
    const obstacles = wireObstacles(view, rects, wire);
    const { sourceSide, targetSide } = sidesFor(source, target, obstacles);
    const from = attachment(source, sourceSide);
    const to = attachment(target, targetSide);
    const route = routeWire({ source: from, sourceSide, target: to, targetSide, obstacles });
    audit.straightCrossings += routeCollisions([from, to], obstacles).collisions;
    audit.crossings += route.collisions;
    audit.frameCrossings += route.softCollisions;
    if (route.collisions > 0) audit.offenders.push(`${wire.id} crosses ${route.collisions}`);
  }
  return audit;
}

describe('no wire crosses a node it is unrelated to', () => {
  /**
   * Guards the glob, not the corpus size.
   *
   * A literal count here fails every time the app creates a diagram — which it can, from the
   * rail — turning a routing gate red for a reason that has nothing to do with routing. What
   * this must actually catch is the glob silently resolving to nothing, so it asserts a floor
   * and lets the library grow.
   */
  it('reads every real diagram', () => {
    expect(records.length).toBeGreaterThanOrEqual(18);
    expect(records.every(([file]) => file.endsWith('.json'))).toBe(true);
  });

  it.each(records)('%s', (_file, record) => {
    expect(auditDiagram(record).offenders).toEqual([]);
  });

  it('is worth having: straight lines between the same ports cross plenty', () => {
    const straight = records.reduce((total, [, record]) =>
      total + auditDiagram(record).straightCrossings, 0);
    expect(straight).toBeGreaterThan(100);
  });

  it('routes the whole library inside a frame budget', () => {
    const started = performance.now();
    for (const [, record] of records) auditDiagram(record);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

/**
 * The gate is only worth having if the application takes the path it measures.
 *
 * It did not: `projectEdges` computed each wire's obstacles and handed them over in edge data,
 * and the renderer's `routeWire` call dropped them — so this suite proved node-avoidance on a
 * code path the canvas never executed, and stayed green while wires cut through nodes on
 * screen. This pins the premise: obstacles must actually change the answer.
 */
describe('obstacles are load-bearing', () => {
  it('routes differently once it is told what is in the way', () => {
    let withObstacles = 0;
    let blind = 0;
    for (const [, record] of records) {
      const view = projectView(record);
      const rects = nodeRects(view);
      for (const wire of view.wires) {
        const source = rects.get(wire.source.nodeId as string);
        const target = rects.get(wire.target.nodeId as string);
        if (!source || !target) continue;
        const obstacles = wireObstacles(view, rects, wire);
        const { sourceSide, targetSide } = sidesFor(source, target, obstacles);
        const from = attachment(source, sourceSide);
        const to = attachment(target, targetSide);
        withObstacles += routeWire({
          source: from, sourceSide, target: to, targetSide, obstacles,
        }).collisions;
        blind += routeCollisions(
          routeWire({ source: from, sourceSide, target: to, targetSide }).points,
          obstacles,
        ).collisions;
      }
    }
    expect(withObstacles).toBe(0);
    expect(blind).toBeGreaterThan(0);
  });
});
