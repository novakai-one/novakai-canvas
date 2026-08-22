import type { ContainerAlign } from '../canvas-presentation.ts';
import type { Size } from '../model.ts';
import type { Rect } from './contract.ts';

export type { Rect } from './contract.ts';

export function rectanglesOverlap(left: Rect, right: Rect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

export function alignedOffset(
  start: number,
  span: number,
  itemSize: number,
  align: ContainerAlign,
): number {
  if (align === 'end') return start + span - itemSize;
  if (align === 'center') return start + Math.round((span - itemSize) / 2);
  return start;
}

export function enclosingSize(
  rectangles: readonly Rect[],
  padding: number,
  minimum: Size,
): Size {
  let maxRight = 0;
  let maxBottom = 0;
  for (const rectangle of rectangles) {
    maxRight = Math.max(maxRight, rectangle.x + rectangle.width);
    maxBottom = Math.max(maxBottom, rectangle.y + rectangle.height);
  }
  return {
    width: Math.max(minimum.width, maxRight + padding),
    height: Math.max(minimum.height, maxBottom + padding),
  };
}
