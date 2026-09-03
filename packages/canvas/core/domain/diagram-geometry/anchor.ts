/**
 * Where one wire end meets one node, on the node's drawn border.
 *
 * A stored anchor names a durable method ordinal on a side; an absent anchor means the centre
 * of whichever side the router chose. Either way the point is computed on the node's rectangle
 * first and then pulled onto the node's outline shape, so a wire always ends exactly on the
 * border a renderer draws from the same shape table.
 */

import { interfaceRowCenter } from '../../components/card/measure.ts';
import { outlinePointToward } from '../../components/outline.ts';
import { portAxisFraction } from '../interface-signature.ts';
import type { CanvasNode, Endpoint, PortAnchor, PortSide } from '../../../contract/records/index.ts';
import type { ResolvedNodeShape } from '../../../contract/schemas/node-appearance.ts';
import type { Point, Rect } from './contract.ts';
import { attachmentPoint } from './view-geometry.ts';

/** A node's on-screen box together with the outline shape its drawn border follows. */
export interface ShapedBox {
  readonly rect: Rect;
  readonly shape: ResolvedNodeShape;
}

/** The rectangle point pulled onto the shape's border along its line from the box centre. */
function onOutline(box: ShapedBox, point: Point): Point {
  const size = { width: box.rect.width, height: box.rect.height };
  const local = outlinePointToward(box.shape, size, {
    x: point.x - box.rect.x,
    y: point.y - box.rect.y,
  });
  return { x: box.rect.x + local.x, y: box.rect.y + local.y };
}

/** The rectangle point a stored anchor names, before the outline pulls it onto the border. */
function anchoredPoint(
  anchor: PortAnchor,
  rect: Rect,
  methodCount: number,
  node?: Pick<CanvasNode, 'description'>,
): Point {
  const fraction = portAxisFraction(anchor.ordinal, methodCount);
  if (anchor.side === 'top') return { x: rect.x + rect.width * fraction, y: rect.y };
  if (anchor.side === 'bottom') {
    return { x: rect.x + rect.width * fraction, y: rect.y + rect.height };
  }
  const row = node
    ? Math.min(rect.height - 8, Math.max(8, interfaceRowCenter(node.description, rect.width, anchor.ordinal)))
    : rect.height * fraction;
  if (anchor.side === 'left') return { x: rect.x, y: rect.y + row };
  return { x: rect.x + rect.width, y: rect.y + row };
}

/**
 * Point on the node's border for one wire end: a durable method ordinal when an anchor is
 * stored, the centre of the given side otherwise — either way pulled onto the shape's outline.
 */
export function anchorFor(
  endpoint: Pick<Endpoint, 'anchor'>,
  box: ShapedBox,
  defaultSide: PortSide,
  methodCount: number,
  node?: Pick<CanvasNode, 'description'>,
): Point {
  const point = endpoint.anchor
    ? anchoredPoint(endpoint.anchor, box.rect, methodCount, node)
    : attachmentPoint(box.rect, defaultSide);
  return onOutline(box, point);
}
