import type { NodeKind } from '../../contract/types/node-kind.ts';
import type {
  FontFamily, NodeAppearance,
} from '../../contract/schemas/node-appearance.ts';
import type {
  PresentationContext, ResolvedNodeAppearance,
} from '../../contract/schemas/node-appearance-resolved.ts';
import { resolveAppearanceTokens } from '../components/appearance.ts';
import { resolveComponentPalette } from '../components/component-palette.ts';
import { defaultPreferences } from './defaults.ts';
import { resolveCanvasTheme, themeTokenColor } from './theme-resolver.ts';

const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'SFMono-Regular, Consolas, monospace',
};

const DEFAULT_THEME = resolveCanvasTheme(defaultPreferences.appearance);

/** Turns filled appearance tokens into the concrete browser/SVG values renderers consume. */
export function resolveNodeAppearance(
  kind: NodeKind,
  authored: NodeAppearance = {},
  context: PresentationContext = { theme: DEFAULT_THEME, showKinds: true },
): ResolvedNodeAppearance {
  const tokens = resolveAppearanceTokens(authored);
  const paletteColors = resolveComponentPalette(
    kind,
    tokens.palette === 'none' ? undefined : tokens.palette,
    context.theme,
  );
  return {
    ...(tokens.icon === 'none' ? {} : { icon: tokens.icon }),
    ...(tokens.palette === 'none' ? {} : { palette: tokens.palette }),
    ...(paletteColors === undefined ? {} : { paletteColors }),
    shape: tokens.shape,
    font: tokens.font,
    fontFamily: FONT_STACKS[tokens.font],
    fontSize: tokens.size,
    fontWeight: tokens.weight,
    textAlign: tokens.align,
    verticalAlign: tokens.verticalAlign,
    textColor: themeTokenColor(context.theme, tokens.text),
    backgroundColor: themeTokenColor(context.theme, tokens.background),
    borderColor: themeTokenColor(context.theme, tokens.borderColor),
    borderWidth: tokens.border,
    borderRadius: tokens.radius === 'pill' ? 999 : tokens.radius,
    padding: tokens.padding,
    badge: tokens.badge,
    showKindBadge: tokens.badge !== 'hide' && context.showKinds,
    theme: context.theme,
  };
}
