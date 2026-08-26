import type {
  CanvasPreferences, ResolvedCanvasTheme, ThemeColorRole, ThemePalette,
} from '../../contract/records/preferences.ts';
import { THEME_COLOR_ROLES } from '../../contract/records/preferences.ts';
import { THEME_PRESETS, THEME_SEMANTICS } from './theme-palettes.ts';

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as unknown as Rgb;
}

function hex(channels: Rgb): string {
  return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Mixes two six-digit hex colours without leaking rendering policy into callers. */
export function mixThemeColors(from: string, to: string, amount: number): string {
  const start = rgb(from);
  const end = rgb(to);
  const ratio = Math.max(0, Math.min(1, amount));
  return hex(start.map((channel, index) => channel + ((end[index] ?? channel) - channel) * ratio) as unknown as Rgb);
}

/** Adds an alpha channel to a six-digit hex colour. */
export function withThemeAlpha(color: string, alpha: number): string {
  const value = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${color}${value}`.toUpperCase();
}

/** Resolves the active preset plus only that preset's user overrides. */
export function resolveCanvasTheme(
  appearance: CanvasPreferences['appearance'],
): ResolvedCanvasTheme {
  const preset = THEME_PRESETS[appearance.preset];
  const overrides = appearance.overridesByPreset[appearance.preset] ?? {};
  const colors = Object.fromEntries(THEME_COLOR_ROLES.map((role) => [
    role, overrides[role] ?? preset.colors[role],
  ])) as ThemePalette;
  return {
    preset: preset.id,
    label: preset.label,
    mode: preset.mode,
    colors,
    semantic: THEME_SEMANTICS[preset.mode],
  };
}

function luminance(color: string): number {
  const channels = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

/** WCAG contrast ratio, used for advisory settings warnings only. */
export function themeContrastRatio(first: string, second: string): number {
  const bright = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (bright + 0.05) / (dark + 0.05);
}

/** Resolves one authored appearance token against the active palette. */
export function themeTokenColor(
  theme: ResolvedCanvasTheme,
  token: ThemeColorRole | 'green' | 'blue' | 'violet' | 'rose' | 'amber'
    | 'green-soft' | 'blue-soft' | 'violet-soft' | 'rose-soft' | 'amber-soft'
    | 'ink' | 'transparent',
): string {
  if (token === 'transparent') return 'transparent';
  if (token === 'ink') return theme.colors.text;
  if (token in theme.colors) return theme.colors[token as ThemeColorRole];
  const soft = token.endsWith('-soft');
  const semanticName = token.replace('-soft', '');
  const semantic = (semanticName === 'green' ? 'sage' : semanticName) as
    keyof ResolvedCanvasTheme['semantic'];
  const color = theme.semantic[semantic];
  return soft ? mixThemeColors(theme.colors.surface, color, theme.mode === 'dark' ? 0.16 : 0.12) : color;
}
