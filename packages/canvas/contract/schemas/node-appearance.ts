import { z } from 'zod';
import { ICON_NAMES, type IconName } from '../records/components.ts';

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

/** Closed card-wide treatments available to opted-in registered components. */
export const COMPONENT_PALETTES = ['neutral', 'blue', 'violet', 'sage'] as const;

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
export type ComponentPalette = (typeof COMPONENT_PALETTES)[number];
export type BlockIcon = IconName;
export type Theme = 'dark' | 'light';

/** Closed authored values stored on a layout, never on a semantic node. */
export interface NodeAppearance {
  icon?: BlockIcon;
  font?: FontFamily;
  size?: FontSize;
  weight?: FontWeight;
  align?: TextAlign;
  verticalAlign?: VerticalAlign;
  text?: InkColor;
  background?: Background;
  borderColor?: InkColor;
  border?: BorderWidth;
  radius?: Radius;
  padding?: Spacing;
  badge?: Badge;
  palette?: ComponentPalette;
}

export interface PresentationContext { theme: Theme; showKinds: boolean }

/** Concrete values consumed verbatim by measurement and both render hosts. */
export interface ResolvedNodeAppearance {
  icon?: BlockIcon;
  font: FontFamily;
  fontFamily: string;
  fontSize: FontSize;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: BorderWidth;
  borderRadius: number;
  padding: Spacing;
  badge: Badge;
  showKindBadge: boolean;
  palette?: ComponentPalette;
  theme: Theme;
}

export type AppearanceKey =
  | 'icon' | 'font' | 'size' | 'weight' | 'align' | 'vertical-align' | 'text' | 'background'
  | 'border-color' | 'border' | 'radius' | 'padding' | 'badge' | 'palette';

export interface AppearanceSpecification {
  key: AppearanceKey;
  values: readonly (string | number)[];
  /** Omitted when the registered component, rather than this shared token, owns the default. */
  default?: string | number;
  jsonKey: keyof NodeAppearance;
}

/** Canonical order for help, discovery, parsing, storage, and printing. */
export const APPEARANCE_SPECIFICATIONS: readonly AppearanceSpecification[] = [
  { key: 'icon', values: ICON_NAMES, default: 'none', jsonKey: 'icon' },
  { key: 'font', values: FONT_FAMILIES, default: 'sans', jsonKey: 'font' },
  { key: 'size', values: FONT_SIZES, default: 14, jsonKey: 'size' },
  { key: 'weight', values: FONT_WEIGHTS, default: 400, jsonKey: 'weight' },
  { key: 'align', values: TEXT_ALIGNS, default: 'left', jsonKey: 'align' },
  { key: 'vertical-align', values: VERTICAL_ALIGNS, default: 'top', jsonKey: 'verticalAlign' },
  { key: 'text', values: INK_COLORS, default: 'ink', jsonKey: 'text' },
  { key: 'background', values: BACKGROUNDS, default: 'transparent', jsonKey: 'background' },
  { key: 'border-color', values: INK_COLORS, default: 'muted', jsonKey: 'borderColor' },
  { key: 'border', values: BORDER_WIDTHS, default: 0, jsonKey: 'border' },
  { key: 'radius', values: RADII, default: 0, jsonKey: 'radius' },
  { key: 'padding', values: SPACINGS, default: 0, jsonKey: 'padding' },
  { key: 'badge', values: BADGES, default: 'default', jsonKey: 'badge' },
  { key: 'palette', values: COMPONENT_PALETTES, jsonKey: 'palette' },
];

const specificationByKey = new Map(APPEARANCE_SPECIFICATIONS.map((spec) => [spec.key, spec]));
const specificationByJsonKey = new Map(APPEARANCE_SPECIFICATIONS.map((spec) => [spec.jsonKey, spec]));

/** Returns shared metadata without giving callers ownership of the permitted values. */
export function appearanceSpecification(key: AppearanceKey): AppearanceSpecification {
  return specificationByKey.get(key) as AppearanceSpecification;
}

export function isAppearanceKey(value: string): value is AppearanceKey {
  return specificationByKey.has(value as AppearanceKey);
}

export function appearanceKeyForJsonKey(value: string): AppearanceKey | undefined {
  return specificationByJsonKey.get(value as keyof NodeAppearance)?.key;
}

/** Parses one closed CLI token to the exact JSON field/value it represents. */
export function appearanceEntry(
  key: AppearanceKey,
  raw: string,
): { jsonKey: keyof NodeAppearance; value: NodeAppearance[keyof NodeAppearance] } | undefined {
  const specification = appearanceSpecification(key);
  const value = specification.values.find((candidate) => String(candidate) === raw);
  return value === undefined ? undefined : {
    jsonKey: specification.jsonKey,
    value: value as NodeAppearance[keyof NodeAppearance],
  };
}

/** Reorders authored values once so semantically identical DSL compares byte-identically. */
export function canonicalNodeAppearance(input: NodeAppearance): NodeAppearance {
  const result: NodeAppearance = {};
  for (const specification of APPEARANCE_SPECIFICATIONS) {
    const value = input[specification.jsonKey];
    if (value !== undefined) {
      (result as Record<string, unknown>)[specification.jsonKey] = value;
    }
  }
  return result;
}

const fontSize = z.union(FONT_SIZES.map((value) => z.literal(value)) as [
  z.ZodLiteral<FontSize>, ...z.ZodLiteral<FontSize>[],
]);
const fontWeight = z.union(FONT_WEIGHTS.map((value) => z.literal(value)) as [
  z.ZodLiteral<FontWeight>, ...z.ZodLiteral<FontWeight>[],
]);
const spacing = z.union(SPACINGS.map((value) => z.literal(value)) as [
  z.ZodLiteral<Spacing>, ...z.ZodLiteral<Spacing>[],
]);
const borderWidth = z.union(BORDER_WIDTHS.map((value) => z.literal(value)) as [
  z.ZodLiteral<BorderWidth>, ...z.ZodLiteral<BorderWidth>[],
]);
const radius = z.union(RADII.map((value) => z.literal(value)) as [
  z.ZodLiteral<Radius>, ...z.ZodLiteral<Radius>[],
]);

/** Strict runtime boundary for stored per-node presentation. */
export const nodeAppearanceSchema = z.object({
  icon: z.enum(ICON_NAMES).optional(),
  font: z.enum(FONT_FAMILIES).optional(),
  size: fontSize.optional(),
  weight: fontWeight.optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
  verticalAlign: z.enum(VERTICAL_ALIGNS).optional(),
  text: z.enum(INK_COLORS).optional(),
  background: z.enum(BACKGROUNDS).optional(),
  borderColor: z.enum(INK_COLORS).optional(),
  border: borderWidth.optional(),
  radius: radius.optional(),
  padding: spacing.optional(),
  badge: z.enum(BADGES).optional(),
  palette: z.enum(COMPONENT_PALETTES).optional(),
}).strict();
