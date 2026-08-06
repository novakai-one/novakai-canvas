/**
 * How big a thing you have to hit with a pointer is.
 *
 * Everything drawn inside the canvas viewport is scaled by the zoom, so a size written in
 * diagram units is a different size to the hand at every zoom level. Only the node ports were
 * ever corrected for that; resize handles, wire ends, corridor handles and wire labels were all
 * sized in diagram units and shrank with the view — which is why Chris reported the whole canvas
 * as "miniscule". These are SCREEN pixels, and the stylesheet divides by the live zoom.
 *
 * Pure and framework-free: the same numbers answer the preference control, the stylesheet, and
 * the tests, so what a person picks and what they get cannot drift apart.
 */

/** How large the user wants canvas controls. */
export type TargetSize = 'small' | 'medium' | 'large';

/** The three control sizes, in screen pixels, plus the multiplier that produced them. */
export interface TargetScale {
  /** Resize handles on a group's corners and edges. */
  handle: number;
  /** The visible dot of a wire end or a corridor handle. */
  dot: number;
  /**
   * The invisible region around a dot that answers the pointer.
   *
   * Deliberately far larger than the dot. The mark stays small so the canvas stays calm, while
   * the thing you actually grab is generous — which is what stops a wire end from snapping back
   * when the pointer strays a few pixels or the mouse is released a moment early.
   */
  grab: number;
  multiplier: number;
}

const BASE = { handle: 9, dot: 12, grab: 22 } as const;

const MULTIPLIER: Record<TargetSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.3,
};

export const TARGET_SIZES: readonly TargetSize[] = ['small', 'medium', 'large'];

/** Rounded to whole pixels: a fractional target size is a subpixel edge nobody asked for. */
export function targetScale(size: TargetSize): TargetScale {
  const multiplier = MULTIPLIER[size] ?? MULTIPLIER.medium;
  return {
    handle: Math.round(BASE.handle * multiplier),
    dot: Math.round(BASE.dot * multiplier),
    grab: Math.round(BASE.grab * multiplier),
    multiplier,
  };
}
