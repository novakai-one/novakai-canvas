import type { CSSProperties } from 'react';
import type { ResolvedCanvasTheme } from '@novakai/canvas';
import {
  mixThemeColors, resolveTreeToneColors, resolveWireToneColors, withThemeAlpha,
} from '@novakai/canvas';

/** The sole browser adapter from resolved theme roles to CSS custom properties. */
export function themeCssVariables(theme: ResolvedCanvasTheme): CSSProperties {
  const { colors, semantic } = theme;
  const wires = resolveWireToneColors(theme);
  const tree = resolveTreeToneColors(theme);
  const faint = mixThemeColors(colors.muted, colors.canvas, theme.mode === 'dark' ? 0.22 : 0.12);
  const edgeSoft = mixThemeColors(colors.border, colors.canvas, 0.34);
  const hover = mixThemeColors(colors.raised, colors.accent, theme.mode === 'dark' ? 0.08 : 0.04);
  const accentStrong = mixThemeColors(colors.accent, colors.text, theme.mode === 'dark' ? 0.12 : 0.08);
  const accentBright = mixThemeColors(colors.accent, colors.text, theme.mode === 'dark' ? 0.28 : 0.18);
  const accentDim = mixThemeColors(colors.accent, colors.canvas, 0.24);
  return {
    '--surface-page': colors.canvas,
    '--surface-1': colors.panel,
    '--surface-2': colors.surface,
    '--surface-3': colors.raised,
    '--ink': colors.text,
    '--ink-muted': colors.muted,
    '--ink-faint': faint,
    '--edge-soft': edgeSoft,
    '--edge': colors.border,
    '--bg': colors.canvas,
    '--bg-read': colors.canvas,
    '--panel': colors.panel,
    '--card': colors.surface,
    '--card-2': colors.raised,
    '--card-3': mixThemeColors(colors.surface, colors.raised, 0.5),
    '--hover': hover,
    '--overlay': withThemeAlpha(colors.panel, 0.94),
    '--scope-fill': withThemeAlpha(colors.panel, 0.52),
    '--border': colors.border,
    '--border-soft': edgeSoft,
    '--ink-strong': colors.text,
    '--ink-soft': mixThemeColors(colors.text, colors.muted, 0.28),
    '--muted': colors.muted,
    '--faint': faint,
    '--scope-fill-read': colors.panel,
    '--scope-border-read': colors.border,
    '--scope-title-read': colors.muted,
    '--card-read': colors.surface,
    '--node-border-read': colors.border,
    '--diagram-node-shadow': theme.mode === 'dark'
      ? '0 2px 8px rgb(0 0 0 / 18%)' : '0 1px 4px rgb(22 36 50 / 10%)',
    '--wire-label-read': colors.muted,
    '--ink-read': colors.text,
    '--muted-read': colors.muted,
    '--faint-read': faint,
    '--accent': colors.accent,
    '--accent-strong': accentStrong,
    '--accent-bright': accentBright,
    '--accent-dim': accentDim,
    '--gold': colors.accent,
    '--gold-bright': accentBright,
    '--gold-ink': theme.mode === 'dark' ? colors.canvas : colors.raised,
    '--sage': semantic.sage,
    '--danger': mixThemeColors(colors.surface, semantic.danger, 0.32),
    '--danger-strong': semantic.danger,
    '--wire': wires.neutral,
    '--wire-strong': mixThemeColors(wires.neutral, colors.text, 0.25),
    '--wire-dim': mixThemeColors(wires.neutral, colors.canvas, 0.55),
    '--wire-label': colors.text,
    ...Object.fromEntries(Object.entries(wires).map(([tone, color]) => [`--wire-${tone}`, color])),
    ...Object.fromEntries(Object.entries(tree).map(([tone, color]) => [`--tree-${tone}`, color])),
  } as CSSProperties;
}
