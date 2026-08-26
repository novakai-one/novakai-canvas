/** Closed, serialisable presentation vocabulary for one wire. */

import { z } from 'zod';

const WIRE_WIDTHS = ['thin', 'medium', 'thick'] as const;
const WIRE_PATTERNS = ['solid', 'dashed', 'dotted', 'dashdot'] as const;
const WIRE_COLORS = ['neutral', 'green', 'blue', 'violet', 'rose', 'amber'] as const;
export const WIRE_SHAPES = ['elbow', 'straight', 'curved', 'stepped'] as const;

type WireWidth = (typeof WIRE_WIDTHS)[number];
type WirePattern = (typeof WIRE_PATTERNS)[number];
type WireColor = (typeof WIRE_COLORS)[number];
export type WireShape = (typeof WIRE_SHAPES)[number];

export const wireShapeSchema = z.enum(WIRE_SHAPES);

/** Authored presentation overrides stored beside a wire's layout. */
export interface WireAppearance {
  width?: WireWidth;
  pattern?: WirePattern;
  color?: WireColor;
  shape?: WireShape;
}

/** Canonical authoring order, permitted values and omitted-value semantics. */
export const WIRE_APPEARANCE_SPECIFICATIONS = [
  { key: 'width', values: WIRE_WIDTHS, omitted: 'current host width' },
  { key: 'pattern', values: WIRE_PATTERNS, omitted: 'semantic wire kind pattern' },
  { key: 'color', values: WIRE_COLORS, omitted: 'semantic wire kind colour' },
  { key: 'shape', values: WIRE_SHAPES, omitted: 'current host shape, then elbow' },
] as const;

/** Strict runtime boundary for stored per-wire presentation. */
export const wireAppearanceSchema = z.object({
  width: z.enum(WIRE_WIDTHS).optional(),
  pattern: z.enum(WIRE_PATTERNS).optional(),
  color: z.enum(WIRE_COLORS).optional(),
  shape: wireShapeSchema.optional(),
}).strict();

/** Canonical width, pattern, colour, shape order for stable DSL and equality. */
export function canonicalWireAppearance(input: WireAppearance): WireAppearance {
  return {
    ...(input.width ? { width: input.width } : {}),
    ...(input.pattern ? { pattern: input.pattern } : {}),
    ...(input.color ? { color: input.color } : {}),
    ...(input.shape ? { shape: input.shape } : {}),
  };
}
