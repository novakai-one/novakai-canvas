/** The one kind→style mapping shared by edges, the legend, and SVG snapshots. */

import type { CanvasTheme, WireKind } from '../domain/model';

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

/** Muted per-theme colours; no neon. CSS variables are injected from this table. */
const WIRE_TONE_COLORS: Record<WireTone, Record<CanvasTheme, string>> = {
  neutral: { dark: '#7a756b', light: '#8a8478' },
  sage: { dark: '#78a886', light: '#4f7d60' },
  steel: { dark: '#7591ad', light: '#4f6d8c' },
  slate: { dark: '#8b93a3', light: '#68707f' },
  violet: { dark: '#9c86b4', light: '#77618f' },
  amber: { dark: '#c39257', light: '#a2743a' },
  rust: { dark: '#b56f63', light: '#a05243' },
};

/** Literal colour for renderers that cannot read CSS variables (markers, SVG). */
export function wireKindColor(kind: WireKind, theme: CanvasTheme): string {
  return WIRE_TONE_COLORS[WIRE_KIND_STYLES[kind].tone][theme];
}

/** Stroke-dasharray for a wire kind ('' = solid). */
export function wireKindDashArray(kind: WireKind): string {
  return WIRE_DASH_ARRAYS[WIRE_KIND_STYLES[kind].dash];
}

/** CSS variable reference carrying this kind's theme-resolved colour. */
export function wireKindColorVariable(kind: WireKind): string {
  return `var(--wire-${WIRE_KIND_STYLES[kind].tone})`;
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
