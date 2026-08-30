import type { ResolvedCanvasTheme } from '../../contract/records/preferences.ts';
import type { ComponentPalette } from '../../contract/schemas/node-appearance.ts';
import type { ComponentPaletteColors } from '../../contract/schemas/node-appearance-resolved.ts';
import type { NodeKind } from '../../contract/types/node-kind.ts';
import { mixThemeColors } from '../domain/theme-resolver.ts';

/** Kinds whose cards are coloured with no authored palette; absent kinds render plain. */
const KIND_PALETTES: Partial<Record<NodeKind, ComponentPalette>> = {
  module: 'blue',
  object: 'violet',
  runtime: 'amber',
  resource: 'sage',
  entity: 'sage',
  'ooux-object': 'blue',
};

function paletteHue(theme: ResolvedCanvasTheme, palette: ComponentPalette): string {
  if (palette === 'neutral') return theme.colors.muted;
  return theme.semantic[palette];
}

/** Card colour slots for one node: the authored palette first, then the kind's default. */
export function resolveComponentPalette(
  kind: NodeKind,
  authored: ComponentPalette | undefined,
  theme: ResolvedCanvasTheme,
): ComponentPaletteColors | undefined {
  const palette = authored ?? KIND_PALETTES[kind];
  if (palette === undefined) return undefined;
  const hue = paletteHue(theme, palette);
  const dark = theme.mode === 'dark';
  return {
    frame: mixThemeColors(theme.colors.border, hue, dark ? 0.72 : 0.8),
    surface: mixThemeColors(theme.colors.surface, hue, dark ? 0.18 : 0.12),
    header: mixThemeColors(theme.colors.raised, hue, dark ? 0.45 : 0.74),
    headerText: dark ? theme.colors.text : theme.colors.raised,
    headerMuted: dark
      ? mixThemeColors(theme.colors.text, hue, 0.18)
      : mixThemeColors(theme.colors.raised, theme.colors.text, 0.12),
    text: theme.colors.text,
    muted: theme.colors.muted,
    core: mixThemeColors(theme.colors.surface, hue, dark ? 0.24 : 0.16),
    metadata: mixThemeColors(theme.colors.surface, hue, dark ? 0.3 : 0.2),
    action: mixThemeColors(theme.colors.surface, hue, dark ? 0.36 : 0.26),
  };
}

/** Converts resolved slots to the one CSS-variable vocabulary used by card renderers. */
export function paletteCssVariables(colors: ComponentPaletteColors): Record<string, string> {
  return {
    '--component-frame': colors.frame,
    '--component-surface': colors.surface,
    '--component-header': colors.header,
    '--component-header-text': colors.headerText,
    '--component-header-muted': colors.headerMuted,
    '--component-text': colors.text,
    '--component-muted': colors.muted,
    '--component-core': colors.core,
    '--component-metadata': colors.metadata,
    '--component-action': colors.action,
  };
}
