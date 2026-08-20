/** The one kind→style mapping shared by edges, the legend, and SVG snapshots. */

import type { CanvasPreferences, CanvasTheme, WireKind } from '../domain/model.ts';
import { WIRE_LABEL_SIZE_LIMITS } from '../domain/wire-label-size.ts';
import type { WireAppearance } from '../domain/wire-appearance.ts';

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
 * Muted per-theme colours; no neon, but every one reads at working zoom.
 *
 * These are the DEFAULT state. Faintness belongs to the dimmed state alone — a wire you cannot
 * follow across a 44-node diagram is not restrained, it is broken.
 */
const WIRE_TONE_COLORS: Record<WireTone, Record<CanvasTheme, string>> = {
  neutral: { dark: '#948d80', light: '#6f695d' },
  sage: { dark: '#8dbd9b', light: '#3f6c51' },
  steel: { dark: '#8aa8c6', light: '#41607f' },
  slate: { dark: '#a2aabb', light: '#5a6271' },
  violet: { dark: '#b19bc9', light: '#68527f' },
  amber: { dark: '#d3a468', light: '#8f6530' },
  rust: { dark: '#c98376', light: '#8f4438' },
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
}

/**
 * Rendered stroke width.
 *
 * The stored preference is a taste dial, not a licence to draw an invisible wire: below the floor
 * a wire disappears into the background at the zoom real diagrams are read at.
 */
const MINIMUM_STROKE = 1.7;

/** Label type and the zoom where keeping it screen-sized would exceed its chosen maximum. */
export function wireLabelSizing(preferences: CanvasPreferences): {
  baseSize: number; maximumSize: number; minimumZoom: number;
} {
  const baseSize = WIRE_LABEL_SIZE_LIMITS.base
    * (preferences.appearance.textScale ?? 1)
    * (preferences.wires.labelScale ?? 1);
  const maximumSize = preferences.wires.maxLabelSize ?? WIRE_LABEL_SIZE_LIMITS.defaultMaximum;
  return { baseSize, maximumSize, minimumZoom: baseSize / maximumSize };
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
  options: { theme: CanvasTheme; fallbackWidth: number },
): ResolvedWireAppearance {
  const tone = authored?.color ? AUTHORED_COLOR_TONES[authored.color] : WIRE_KIND_STYLES[kind].tone;
  const pattern: WirePattern = authored?.pattern ?? WIRE_KIND_STYLES[kind].dash;
  return {
    strokeColor: WIRE_TONE_COLORS[tone][options.theme],
    strokeColorCss: `var(--wire-${tone})`,
    strokeWidth: authored?.width ? AUTHORED_WIDTHS[authored.width] : options.fallbackWidth,
    dashArray: WIRE_DASH_ARRAYS[pattern],
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
