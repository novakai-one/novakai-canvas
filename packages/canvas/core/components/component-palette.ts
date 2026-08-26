import type { ResolvedCanvasTheme } from '../../contract/records/preferences.ts';
import type { ComponentPalette } from '../../contract/schemas/node-appearance.ts';
import { mixThemeColors } from '../domain/theme-resolver.ts';

export type ComponentPaletteFamily = 'entity' | 'ooux' | 'standard';

/** Concrete card slots shared by browser CSS variables and SVG attributes. */
export interface ComponentPaletteColors {
  frame: string;
  surface: string;
  header: string;
  headerText: string;
  headerMuted: string;
  text: string;
  muted: string;
  core: string;
  metadata: string;
  action: string;
}

function paletteHue(theme: ResolvedCanvasTheme, palette: ComponentPalette): string {
  if (palette === 'neutral') return theme.colors.muted;
  return theme.semantic[palette];
}

/** Resolves component slots from the active theme instead of owning a second palette table. */
export function resolveComponentPalette(
  palette: ComponentPalette | undefined,
  theme: ResolvedCanvasTheme,
  family: ComponentPaletteFamily,
): ComponentPaletteColors | undefined {
  if (palette === undefined && family === 'standard') return undefined;
  const resolved = palette ?? (family === 'entity' ? 'violet' : 'blue');
  const hue = paletteHue(theme, resolved);
  const dark = theme.mode === 'dark';
  return {
    frame: mixThemeColors(theme.colors.border, hue, dark ? 0.72 : 0.8),
    surface: mixThemeColors(theme.colors.surface, hue, dark ? 0.07 : 0.035),
    header: mixThemeColors(theme.colors.raised, hue, dark ? 0.38 : 0.74),
    headerText: dark ? theme.colors.text : theme.colors.raised,
    headerMuted: dark
      ? mixThemeColors(theme.colors.text, hue, 0.18)
      : mixThemeColors(theme.colors.raised, theme.colors.text, 0.12),
    text: theme.colors.text,
    muted: theme.colors.muted,
    core: mixThemeColors(theme.colors.surface, hue, dark ? 0.15 : 0.09),
    metadata: mixThemeColors(theme.colors.surface, hue, dark ? 0.22 : 0.14),
    action: mixThemeColors(theme.colors.surface, hue, dark ? 0.3 : 0.2),
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
