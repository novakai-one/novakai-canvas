/** Closed, serialisable presentation vocabulary for one wire. */

import { z } from 'zod';

const WIRE_WIDTHS = ['thin', 'medium', 'thick'] as const;
const WIRE_PATTERNS = ['solid', 'dashed', 'dotted', 'dashdot'] as const;
const WIRE_COLORS = ['neutral', 'green', 'blue', 'violet', 'rose', 'amber'] as const;

type WireWidth = (typeof WIRE_WIDTHS)[number];
type WirePattern = (typeof WIRE_PATTERNS)[number];
type WireColor = (typeof WIRE_COLORS)[number];

/** Authored presentation overrides stored beside a wire's layout. */
export interface WireAppearance {
  width?: WireWidth;
  pattern?: WirePattern;
  color?: WireColor;
}

/** Canonical authoring order, permitted values and omitted-value semantics. */
export const WIRE_APPEARANCE_SPECIFICATIONS = [
  { key: 'width', values: WIRE_WIDTHS, omitted: 'current host width' },
  { key: 'pattern', values: WIRE_PATTERNS, omitted: 'semantic wire kind pattern' },
  { key: 'color', values: WIRE_COLORS, omitted: 'semantic wire kind colour' },
] as const;

/** Strict runtime boundary for stored per-wire presentation. */
export const wireAppearanceSchema = z.object({
  width: z.enum(WIRE_WIDTHS).optional(),
  pattern: z.enum(WIRE_PATTERNS).optional(),
  color: z.enum(WIRE_COLORS).optional(),
}).strict();

/** Canonical width, pattern, colour order for stable DSL and equality. */
export function canonicalWireAppearance(input: WireAppearance): WireAppearance {
  return {
    ...(input.width ? { width: input.width } : {}),
    ...(input.pattern ? { pattern: input.pattern } : {}),
    ...(input.color ? { color: input.color } : {}),
  };
}
