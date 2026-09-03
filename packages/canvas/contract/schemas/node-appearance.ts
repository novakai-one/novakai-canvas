/**
 * The stored node-appearance vocabulary: the values an author may store per node and the
 * runtime schema that guards them at the record boundary. Storing nothing means the
 * component's own presentation. What each absent field means is declared in
 * `node-appearance-authoring.ts`; the filled render-side view lives in
 * `node-appearance-resolved.ts`.
 */
import { z } from 'zod';
import { ICON_NAMES } from '../records/components.ts';
import type { ResolvedCanvasTheme } from '../records/preferences.ts';

export const FONT_FAMILIES = ['sans', 'serif', 'mono'] as const;
export const FONT_SIZES = [12, 14, 16, 20, 24, 32, 40] as const;
export const FONT_WEIGHTS = [400, 500, 600, 700] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export const VERTICAL_ALIGNS = ['top', 'center', 'bottom'] as const;
export const INK_COLORS = ['ink', 'muted', 'green', 'blue', 'violet', 'rose', 'amber'] as const;
export const BACKGROUNDS = [
  'transparent', 'surface', 'green-soft', 'blue-soft', 'violet-soft', 'rose-soft', 'amber-soft',
] as const;
export const SPACINGS = [0, 4, 8, 12, 16, 24, 32] as const;
export const BORDER_WIDTHS = [0, 1, 2] as const;
export const RADII = [0, 4, 8, 12, 16, 'pill'] as const;
export const BADGES = ['default', 'hide'] as const;

/** Stored departures from the rectangle. Storing nothing means a rectangle. */
export const NODE_SHAPES = ['ellipse', 'diamond'] as const;

/** Closed card-wide treatments available to opted-in registered components. */
export const COMPONENT_PALETTES = ['neutral', 'blue', 'violet', 'sage', 'amber', 'rose'] as const;

/** Strict runtime boundary for stored per-node presentation. */
export const nodeAppearanceSchema = z.strictObject({
  icon: z.enum(ICON_NAMES).optional(),
  font: z.enum(FONT_FAMILIES).optional(),
  size: z.literal(FONT_SIZES).optional(),
  weight: z.literal(FONT_WEIGHTS).optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
  verticalAlign: z.enum(VERTICAL_ALIGNS).optional(),
  text: z.enum(INK_COLORS).optional(),
  background: z.enum(BACKGROUNDS).optional(),
  shape: z.enum(NODE_SHAPES).optional(),
  borderColor: z.enum(INK_COLORS).optional(),
  border: z.literal(BORDER_WIDTHS).optional(),
  radius: z.literal(RADII).optional(),
  padding: z.literal(SPACINGS).optional(),
  badge: z.enum(BADGES).optional(),
  palette: z.enum(COMPONENT_PALETTES).optional(),
});

/** Closed authored values stored on a layout, never on a semantic node. */
export type NodeAppearance = z.infer<typeof nodeAppearanceSchema>;

export type FontFamily = (typeof FONT_FAMILIES)[number];
export type FontSize = (typeof FONT_SIZES)[number];
export type FontWeight = (typeof FONT_WEIGHTS)[number];
export type TextAlign = (typeof TEXT_ALIGNS)[number];
export type VerticalAlign = (typeof VERTICAL_ALIGNS)[number];
export type InkColor = (typeof INK_COLORS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Spacing = (typeof SPACINGS)[number];
export type BorderWidth = (typeof BORDER_WIDTHS)[number];
export type Radius = (typeof RADII)[number];
export type Badge = (typeof BADGES)[number];
export type NodeShape = (typeof NODE_SHAPES)[number];
/** Storage leaves the rectangle out; anything that draws a node needs it back. */
export type ResolvedNodeShape = NodeShape | 'rect';
export type ComponentPalette = (typeof COMPONENT_PALETTES)[number];
export type Theme = ResolvedCanvasTheme['mode'];
