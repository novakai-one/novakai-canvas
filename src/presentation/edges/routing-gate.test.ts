import { describe, expect, it } from 'vitest';
import { diagramRecordSchema, projectView } from '../../canvas';
import type { DiagramRecord } from '../../canvas';
import { ARCHITECTURE_FLOW } from '../../domain/flow';
import { nodeRects, wireObstacles } from '../projection';
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

const sourceSide = ARCHITECTURE_FLOW.sourcePort as RouteSide;
const targetSide = ARCHITECTURE_FLOW.targetPort as RouteSide;

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
    const from = attachment(source, sourceSide);
    const to = attachment(target, targetSide);
    const obstacles = wireObstacles(view, rects, wire);
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
