/** The one kind→style mapping shared by edges, the legend, and SVG snapshots. */

import type { CanvasPreferences, CanvasTheme, WireKind } from '../domain/model.ts';
import { WIRE_LABEL_SIZE_LIMITS } from '../domain/wire-label-size.ts';
import type { WireAppearance, WireShape } from '../domain/wire-appearance.ts';

type WireDash = 'solid' | 'dashed' | 'dotted' | 'dashdot';
type WireTone = 'neutral' | 'sage' | 'steel' | 'slate' | 'violet' | 'amber' | 'rust';

interface WireKindStyle {
  dash: WireDash;
  tone: WireTone;
  /** Legend wording for the relationship this kind carries. */
  legend: string;
}

/** Every wire kind renders visibly distinct: dash pattern plus restrained colour. */
export const WIRE_KIND_STYLES: Record<WireKind, WireKindStyle> = {
  owns: { dash: 'solid', tone: 'neutral', legend: 'owns — structural parent' },
  references: { dash: 'solid', tone: 'sage', legend: 'references — typed, machine-joinable' },
  assigns: { dash: 'dashed', tone: 'steel', legend: 'assigns — pushes state' },
  queries: { dash: 'dashdot', tone: 'slate', legend: 'queries — read-only composition' },
  executes: { dash: 'solid', tone: 'violet', legend: 'executes — invokes behaviour' },
  mentions: { dash: 'dashed', tone: 'amber', legend: 'mentions — free text, human-only' },
  missing: { dash: 'dotted', tone: 'rust', legend: 'missing — no link exists' },
};

/** SVG stroke-dasharray per dash pattern; empty string draws solid. */
const WIRE_DASH_ARRAYS: Record<WireDash, string> = {
  solid: '',
  dashed: '7 5',
  dotted: '2 4',
  dashdot: '9 4 2 4',
};

/**
 * Muted per-theme colours; dash patterns carry the primary semantic distinction.
 *
 * The tones stay close enough to form one supporting layer instead of seven competing accents.
 * Interaction opacity is owned by canvas-wires.css so selection can still make one path crisp.
 */
const WIRE_TONE_COLORS: Record<WireTone, Record<CanvasTheme, string>> = {
  neutral: { dark: '#6f7278', light: '#73777b' },
  sage: { dark: '#748078', light: '#6f7b73' },
  steel: { dark: '#717c86', light: '#747d87' },
  slate: { dark: '#777a82', light: '#787a81' },
  violet: { dark: '#7c7583', light: '#7e7783' },
  amber: { dark: '#81786d', light: '#847b70' },
  rust: { dark: '#826e6a', light: '#886f6b' },
};

const AUTHORED_COLOR_TONES: Record<WireColor, WireTone> = {
  neutral: 'neutral', green: 'sage', blue: 'steel', violet: 'violet', rose: 'rust', amber: 'amber',
};

const AUTHORED_WIDTHS: Record<WireWidth, number> = { thin: 1.7, medium: 2.4, thick: 3.2 };

type WireColor = NonNullable<WireAppearance['color']>;
type WirePattern = NonNullable<WireAppearance['pattern']>;
type WireWidth = NonNullable<WireAppearance['width']>;

export interface ResolvedWireAppearance {
  strokeColor: string;
  strokeColorCss: string;
  strokeWidth: number;
  dashArray: string;
  shape: WireShape;
}

/**
 * Rendered stroke width.
 *
 * The stored preference is a taste dial, not a licence to draw an invisible wire: below the floor
 * a wire disappears into the background at the zoom real diagrams are read at.
 */
const MINIMUM_STROKE = 1.7;

/** Label type sizing; visibility remains solely under the explicit wire-label preference. */
export function wireLabelSizing(preferences: CanvasPreferences): {
  baseSize: number; maximumSize: number;
} {
  const baseSize = WIRE_LABEL_SIZE_LIMITS.base
    * (preferences.appearance.textScale ?? 1)
    * (preferences.wires.labelScale ?? 1);
  const maximumSize = preferences.wires.maxLabelSize ?? WIRE_LABEL_SIZE_LIMITS.defaultMaximum;
  return { baseSize, maximumSize };
}

/** Stroke width for one wire, never thinner than the legibility floor. */
export function wireStrokeWidth(preferred: number | undefined): number {
  return Math.max(preferred ?? MINIMUM_STROKE, MINIMUM_STROKE);
}

/** Stroke-dasharray for a wire kind ('' = solid). */
export function wireKindDashArray(kind: WireKind): string {
  return WIRE_DASH_ARRAYS[WIRE_KIND_STYLES[kind].dash];
}

/** CSS variable reference carrying this kind's theme-resolved colour. */
export function wireKindColorVariable(kind: WireKind): string {
  return `var(--wire-${WIRE_KIND_STYLES[kind].tone})`;
}

/** The one appearance resolver consumed by web paths, markers and SVG snapshots. */
export function resolveWireAppearance(
  kind: WireKind,
  authored: WireAppearance | undefined,
  options: { theme: CanvasTheme; fallbackWidth: number; fallbackShape?: WireShape },
): ResolvedWireAppearance {
  const tone = authored?.color ? AUTHORED_COLOR_TONES[authored.color] : WIRE_KIND_STYLES[kind].tone;
  const pattern: WirePattern = authored?.pattern ?? WIRE_KIND_STYLES[kind].dash;
  return {
    strokeColor: WIRE_TONE_COLORS[tone][options.theme],
    strokeColorCss: `var(--wire-${tone})`,
    strokeWidth: authored?.width ? AUTHORED_WIDTHS[authored.width] : options.fallbackWidth,
    dashArray: WIRE_DASH_ARRAYS[pattern],
    shape: authored?.shape ?? options.fallbackShape ?? 'elbow',
  };
}

/** Tree-row tone colours, kept beside wire tones so every renderer shares one table. */
export const TREE_TONE_COLORS: Record<string, Record<CanvasTheme, string>> = {
  project: { dark: '#6ea08f', light: '#3f7263' },
  done: { dark: '#78a886', light: '#4f7d60' },
  active: { dark: '#7591ad', light: '#4f6d8c' },
  muted: { dark: '#8a857c', light: '#82796b' },
  tombstone: { dark: '#66625a', light: '#9c9488' },
  badge: { dark: '#c39257', light: '#a2743a' },
};

/** CSS custom properties for one theme, applied at the app shell. */
export function wireToneCssVariables(theme: CanvasTheme): Record<string, string> {
  return Object.fromEntries([
    ...Object.entries(WIRE_TONE_COLORS).map(([tone, colors]) => [`--wire-${tone}`, colors[theme]]),
    ...Object.entries(TREE_TONE_COLORS).map(([tone, colors]) => [`--tree-${tone}`, colors[theme]]),
  ]);
}
