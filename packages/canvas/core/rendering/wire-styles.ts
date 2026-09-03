/** The one kind→style mapping shared by interactive edges and SVG snapshots. */

import type { CanvasPreferences, ResolvedCanvasTheme, WireKind } from '../../contract/records/legacy.ts';
import { WIRE_LABEL_SIZE_LIMITS } from '../../contract/schemas/preferences.ts';
import type { WireAppearance, WireShape } from '../../contract/schemas/wire-appearance.ts';
import { mixThemeColors } from '../domain/theme-resolver.ts';

type WireDash = 'solid' | 'dashed' | 'dotted' | 'dashdot';
type WireTone = 'neutral' | 'sage' | 'steel' | 'slate' | 'violet' | 'amber' | 'rust';

interface WireKindStyle {
  dash: WireDash;
  tone: WireTone;
}

/** Every wire kind renders visibly distinct: dash pattern plus restrained colour. */
export const WIRE_KIND_STYLES: Record<WireKind, WireKindStyle> = {
  owns: { dash: 'solid', tone: 'neutral' },
  references: { dash: 'solid', tone: 'sage' },
  assigns: { dash: 'dashed', tone: 'steel' },
  queries: { dash: 'dashdot', tone: 'slate' },
  executes: { dash: 'solid', tone: 'violet' },
  mentions: { dash: 'dashed', tone: 'amber' },
  missing: { dash: 'dotted', tone: 'rust' },
};

/** SVG stroke-dasharray per dash pattern; empty string draws solid. */
const WIRE_DASH_ARRAYS: Record<WireDash, string> = {
  solid: '',
  dashed: '7 5',
  dotted: '2 4',
  dashdot: '9 4 2 4',
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
  options: { theme: ResolvedCanvasTheme; fallbackWidth: number; fallbackShape?: WireShape },
): ResolvedWireAppearance {
  const tone = authored?.color ? AUTHORED_COLOR_TONES[authored.color] : WIRE_KIND_STYLES[kind].tone;
  const pattern: WirePattern = authored?.pattern ?? WIRE_KIND_STYLES[kind].dash;
  const colors = resolveWireToneColors(options.theme);
  return {
    strokeColor: colors[tone],
    strokeColorCss: `var(--wire-${tone})`,
    strokeWidth: authored?.width ? AUTHORED_WIDTHS[authored.width] : options.fallbackWidth,
    dashArray: WIRE_DASH_ARRAYS[pattern],
    shape: authored?.shape ?? options.fallbackShape ?? 'elbow',
  };
}

/** Wire tones derived from one theme; dash pattern and hue together carry the wire kind. */
export function resolveWireToneColors(theme: ResolvedCanvasTheme): Record<WireTone, string> {
  const muted = theme.colors.muted;
  return {
    neutral: mixThemeColors(muted, theme.colors.border, 0.28),
    sage: mixThemeColors(muted, theme.semantic.sage, 0.62),
    steel: mixThemeColors(muted, theme.semantic.blue, 0.62),
    slate: mixThemeColors(muted, theme.colors.text, 0.26),
    violet: mixThemeColors(muted, theme.semantic.violet, 0.6),
    amber: mixThemeColors(muted, theme.semantic.amber, 0.56),
    rust: mixThemeColors(muted, theme.semantic.danger, 0.6),
  };
}

/** Tree status colours share the same semantic source as nodes and wires. */
export function resolveTreeToneColors(theme: ResolvedCanvasTheme): Record<string, string> {
  return {
    project: mixThemeColors(theme.colors.muted, theme.semantic.sage, 0.5),
    done: theme.semantic.sage,
    active: theme.semantic.blue,
    muted: theme.colors.muted,
    tombstone: mixThemeColors(theme.colors.muted, theme.colors.canvas, 0.34),
    badge: theme.semantic.amber,
  };
}
