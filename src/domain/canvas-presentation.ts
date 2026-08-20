import { z } from 'zod';
import type { NodeKind } from './records.ts';
import { ICON_NAMES, type IconName } from './model.ts';

export const FONT_FAMILIES = ['sans', 'serif', 'mono'] as const;
export const FONT_SIZES = [12, 14, 16, 20, 24, 32, 40] as const;
export const FONT_WEIGHTS = [400, 500, 600, 700] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export const INK_COLORS = ['ink', 'muted', 'green', 'blue', 'violet', 'rose', 'amber'] as const;
export const BACKGROUNDS = [
  'transparent', 'surface', 'green-soft', 'blue-soft', 'violet-soft', 'rose-soft', 'amber-soft',
] as const;
export const SPACINGS = [0, 4, 8, 12, 16, 24, 32] as const;
export const BORDER_WIDTHS = [0, 1, 2] as const;
export const RADII = [0, 4, 8, 12, 16, 'pill'] as const;
export const LAYOUT_MODES = ['stack', 'row', 'grid'] as const;
export const CONTAINER_ALIGNS = ['stretch', 'start', 'center', 'end'] as const;
export const GRID_COLUMNS = [1, 2, 3, 4, 5, 6] as const;
export const BADGES = ['default', 'hide'] as const;

export type FontFamily = (typeof FONT_FAMILIES)[number];
export type FontSize = (typeof FONT_SIZES)[number];
export type FontWeight = (typeof FONT_WEIGHTS)[number];
export type TextAlign = (typeof TEXT_ALIGNS)[number];
export type InkColor = (typeof INK_COLORS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Spacing = (typeof SPACINGS)[number];
export type BorderWidth = (typeof BORDER_WIDTHS)[number];
export type Radius = (typeof RADII)[number];
export type LayoutMode = (typeof LAYOUT_MODES)[number];
export type ContainerAlign = (typeof CONTAINER_ALIGNS)[number];
export type GridColumns = (typeof GRID_COLUMNS)[number];
export type Badge = (typeof BADGES)[number];
export type BlockIcon = IconName;
export type Theme = 'dark' | 'light';

/** Closed authored values stored on a layout, never on a semantic node. */
export interface NodeAppearance {
  icon?: BlockIcon;
  font?: FontFamily;
  size?: FontSize;
  weight?: FontWeight;
  align?: TextAlign;
  text?: InkColor;
  background?: Background;
  borderColor?: InkColor;
  border?: BorderWidth;
  radius?: Radius;
  padding?: Spacing;
  badge?: Badge;
}

/** Final container vocabulary. Arrangement behaviour activates in later slices. */
export interface ContainerArrangement {
  layout: LayoutMode;
  childIds: string[];
  gap: Spacing;
  align: ContainerAlign;
  columns?: GridColumns;
}

/** Container values as authored, before compilation supplies direct-child identities. */
export type AuthoredArrangement = Omit<ContainerArrangement, 'childIds'>;

/** One parsed declaration's presentation, interpreted against its owning component metadata. */
export type ParsedPresentation = {
  appearance?: NodeAppearance;
  arrangement?: AuthoredArrangement;
};

export interface PresentationContext { theme: Theme; showKinds: boolean }

/** Concrete values consumed verbatim by measurement and both render hosts. */
export interface ResolvedNodeAppearance {
  icon?: BlockIcon;
  font: FontFamily;
  fontFamily: string;
  fontSize: FontSize;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: BorderWidth;
  borderRadius: number;
  padding: Spacing;
  badge: Badge;
  showKindBadge: boolean;
}

export type AppearanceKey =
  | 'icon' | 'font' | 'size' | 'weight' | 'align' | 'text' | 'background'
  | 'border-color' | 'border' | 'radius' | 'padding' | 'badge';
export type ArrangementKey = 'layout' | 'columns' | 'gap' | 'align';

export interface AppearanceSpecification {
  key: AppearanceKey;
  values: readonly (string | number)[];
  default: string | number;
  jsonKey: keyof NodeAppearance;
}

/** Canonical order for help, discovery, parsing, storage, and printing. */
export const APPEARANCE_SPECIFICATIONS: readonly AppearanceSpecification[] = [
  { key: 'icon', values: ICON_NAMES, default: 'none', jsonKey: 'icon' },
  { key: 'font', values: FONT_FAMILIES, default: 'sans', jsonKey: 'font' },
  { key: 'size', values: FONT_SIZES, default: 14, jsonKey: 'size' },
  { key: 'weight', values: FONT_WEIGHTS, default: 400, jsonKey: 'weight' },
  { key: 'align', values: TEXT_ALIGNS, default: 'left', jsonKey: 'align' },
  { key: 'text', values: INK_COLORS, default: 'ink', jsonKey: 'text' },
  { key: 'background', values: BACKGROUNDS, default: 'transparent', jsonKey: 'background' },
  { key: 'border-color', values: INK_COLORS, default: 'muted', jsonKey: 'borderColor' },
  { key: 'border', values: BORDER_WIDTHS, default: 0, jsonKey: 'border' },
  { key: 'radius', values: RADII, default: 0, jsonKey: 'radius' },
  { key: 'padding', values: SPACINGS, default: 0, jsonKey: 'padding' },
  { key: 'badge', values: BADGES, default: 'default', jsonKey: 'badge' },
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

/** Reserved now so pre-activation container attributes fail instead of becoming descriptions. */
export function isPresentationAttributeKey(value: string): boolean {
  return isAppearanceKey(value) || ['layout', 'columns', 'gap'].includes(value);
}

export function isArrangementKey(value: string): value is ArrangementKey {
  return ['layout', 'columns', 'gap', 'align'].includes(value);
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

const fontFamily = z.enum(FONT_FAMILIES);
const fontSize = z.union(FONT_SIZES.map((value) => z.literal(value)) as [z.ZodLiteral<FontSize>, ...z.ZodLiteral<FontSize>[]]);
const fontWeight = z.union(FONT_WEIGHTS.map((value) => z.literal(value)) as [z.ZodLiteral<FontWeight>, ...z.ZodLiteral<FontWeight>[]]);
const spacing = z.union(SPACINGS.map((value) => z.literal(value)) as [z.ZodLiteral<Spacing>, ...z.ZodLiteral<Spacing>[]]);
const borderWidth = z.union(BORDER_WIDTHS.map((value) => z.literal(value)) as [z.ZodLiteral<BorderWidth>, ...z.ZodLiteral<BorderWidth>[]]);
const radius = z.union(RADII.map((value) => z.literal(value)) as [z.ZodLiteral<Radius>, ...z.ZodLiteral<Radius>[]]);
const columns = z.union(GRID_COLUMNS.map((value) => z.literal(value)) as [z.ZodLiteral<GridColumns>, ...z.ZodLiteral<GridColumns>[]]);

/** Strict runtime boundary for stored per-node presentation. */
export const nodeAppearanceSchema = z.object({
  icon: z.enum(ICON_NAMES).optional(),
  font: fontFamily.optional(),
  size: fontSize.optional(),
  weight: fontWeight.optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
  text: z.enum(INK_COLORS).optional(),
  background: z.enum(BACKGROUNDS).optional(),
  borderColor: z.enum(INK_COLORS).optional(),
  border: borderWidth.optional(),
  radius: radius.optional(),
  padding: spacing.optional(),
  badge: z.enum(BADGES).optional(),
}).strict();

/** Strict runtime boundary for the later container slices. */
export const containerArrangementSchema = z.object({
  layout: z.enum(LAYOUT_MODES),
  childIds: z.array(z.string().min(1)),
  gap: spacing,
  align: z.enum(CONTAINER_ALIGNS),
  columns: columns.optional(),
}).strict().superRefine((arrangement, context) => {
  if (arrangement.layout === 'grid' && arrangement.columns === undefined) {
    context.addIssue({ code: 'custom', message: 'grid arrangement requires columns', path: ['columns'] });
  }
  if (arrangement.layout !== 'grid' && arrangement.columns !== undefined) {
    context.addIssue({ code: 'custom', message: 'columns is only valid for grid arrangement', path: ['columns'] });
  }
  if (new Set(arrangement.childIds).size !== arrangement.childIds.length) {
    context.addIssue({ code: 'custom', message: 'arrangement childIds must be unique', path: ['childIds'] });
  }
});

export const layoutPresentationSchema = z.object({
  appearanceByNodeId: z.record(z.string(), nodeAppearanceSchema),
  arrangementByContainerId: z.record(z.string(), containerArrangementSchema),
}).strict();

const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'SFMono-Regular, Consolas, monospace',
};

const PALETTE = {
  dark: {
    ink: '#ececee', muted: '#a2a2aa', green: '#78a886', blue: '#7f9fc7',
    violet: '#a08ac8', rose: '#c08a98', amber: '#d0a14b', surface: '#252529',
    'green-soft': '#1b261f', 'blue-soft': '#1b222b', 'violet-soft': '#241f2b',
    'rose-soft': '#2a2024', 'amber-soft': '#2b2519', transparent: 'transparent',
  },
  light: {
    ink: '#26262a', muted: '#5f5f66', green: '#4f7b5b', blue: '#4e6f99',
    violet: '#6f579c', rose: '#925867', amber: '#9a6f24', surface: '#ffffff',
    'green-soft': '#e8f1e9', 'blue-soft': '#e8eef6', 'violet-soft': '#eee9f7',
    'rose-soft': '#f6e9ed', 'amber-soft': '#f7efdf', transparent: 'transparent',
  },
} as const;

/** The single owner of defaults and concrete browser/SVG values. */
export function resolveNodeAppearance(
  _kind: NodeKind,
  authored: NodeAppearance = {},
  context: PresentationContext = { theme: 'dark', showKinds: true },
): ResolvedNodeAppearance {
  const font = authored.font ?? 'sans';
  const text = authored.text ?? 'ink';
  const background = authored.background ?? 'transparent';
  const borderColor = authored.borderColor ?? 'muted';
  const radius = authored.radius ?? 0;
  const badge = authored.badge ?? 'default';
  return {
    ...(authored.icon === undefined ? {} : { icon: authored.icon }),
    font,
    fontFamily: FONT_STACKS[font],
    fontSize: authored.size ?? 14,
    fontWeight: authored.weight ?? 400,
    textAlign: authored.align ?? 'left',
    textColor: PALETTE[context.theme][text],
    backgroundColor: PALETTE[context.theme][background],
    borderColor: PALETTE[context.theme][borderColor],
    borderWidth: authored.border ?? 0,
    borderRadius: radius === 'pill' ? 999 : radius,
    padding: authored.padding ?? 0,
    badge,
    showKindBadge: badge !== 'hide' && context.showKinds,
  };
}
