/** Pure crow's-foot endpoint geometry shared by the browser and SVG snapshot. */

import type { Point } from '../domain/diagram-geometry.ts';
import type { WireCardinality } from '../../contract/schemas/wire-cardinality.ts';

interface DecorationLine { from: Point; to: Point }
interface DecorationCircle { center: Point; radius: number }
interface WireEndDecorationPlan {
  bodyPoints: Point[];
  lines: DecorationLine[];
  circles: DecorationCircle[];
  notationMode: boolean;
}

const BAR_HALF = 5;

function add(point: Point, axis: Point, distance: number, normal: Point, offset = 0): Point {
  return {
    x: point.x + axis.x * distance + normal.x * offset,
    y: point.y + axis.y * distance + normal.y * offset,
  };
}

function direction(points: Point[], fromStart: boolean): Point | undefined {
  const ordered = fromStart ? points : [...points].reverse();
  const origin = ordered[0];
  if (!origin) return undefined;
  for (const point of ordered.slice(1)) {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) return { x: dx / length, y: dy / length };
  }
  return undefined;
}

function trimStart(points: Point[], distance: number): Point[] {
  if (distance <= 0 || points.length < 2) return points.map((point) => ({ ...point }));
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) continue;
    if (remaining < length) {
      const ratio = remaining / length;
      return [{ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio },
        ...points.slice(index).map((point) => ({ ...point }))];
    }
    remaining -= length;
  }
  const last = points.at(-1) ?? { x: 0, y: 0 };
  return [{ ...last }, { ...last }];
}

function glyph(
  endpoint: Point,
  axis: Point,
  cardinality: WireCardinality,
): { lines: DecorationLine[]; circles: DecorationCircle[]; trim: number } {
  const normal = { x: -axis.y, y: axis.x };
  const lines: DecorationLine[] = [];
  const circles: DecorationCircle[] = [];
  const bar = (distance: number): void => {
    lines.push({
      from: add(endpoint, axis, distance, normal, -BAR_HALF),
      to: add(endpoint, axis, distance, normal, BAR_HALF),
    });
  };
  const many = (): void => {
    const joint = add(endpoint, axis, 12, normal);
    lines.push(
      { from: joint, to: add(endpoint, axis, 4, normal, -6) },
      { from: joint, to: add(endpoint, axis, 4, normal) },
      { from: joint, to: add(endpoint, axis, 4, normal, 6) },
    );
  };
  if (cardinality === 'one') { bar(4); bar(11); }
  if (cardinality === 'zero-or-one') { bar(4); circles.push({ center: add(endpoint, axis, 12, normal), radius: 3.2 }); }
  if (cardinality === 'one-or-many') { many(); bar(19); }
  if (cardinality === 'zero-or-many') { many(); circles.push({ center: add(endpoint, axis, 19, normal), radius: 3.2 }); }
  const trim = cardinality === 'zero-or-many' ? 23 : cardinality.includes('many') ? 21 : 16;
  return { lines, circles, trim };
}

/** Plans notation and removes the underlying body from beneath every endpoint glyph. */
export function planWireEndDecorations(
  points: Point[],
  source?: WireCardinality,
  target?: WireCardinality,
): WireEndDecorationPlan {
  const lines: DecorationLine[] = [];
  const circles: DecorationCircle[] = [];
  let bodyPoints = points.map((point) => ({ ...point }));
  if (source && points[0]) {
    const axis = direction(points, true);
    if (axis) {
      const plan = glyph(points[0], axis, source);
      lines.push(...plan.lines); circles.push(...plan.circles);
      bodyPoints = trimStart(bodyPoints, plan.trim);
    }
  }
  if (target && points.at(-1)) {
    const axis = direction(points, false);
    if (axis) {
      const plan = glyph(points.at(-1)!, axis, target);
      lines.push(...plan.lines); circles.push(...plan.circles);
      bodyPoints = trimStart([...bodyPoints].reverse(), plan.trim).reverse();
    }
  }
  return { bodyPoints, lines, circles, notationMode: Boolean(source || target) };
}
