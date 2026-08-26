import type { NodeKind } from '../../contract/types/node-kind.ts';
import type {
  FontFamily, NodeAppearance, PresentationContext, ResolvedNodeAppearance,
} from '../../contract/schemas/node-appearance.ts';
import { defaultPreferences } from './defaults.ts';
import { resolveCanvasTheme, themeTokenColor } from './theme-resolver.ts';

const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'SFMono-Regular, Consolas, monospace',
};

const DEFAULT_THEME = resolveCanvasTheme(defaultPreferences.appearance);

/** The single owner of defaults and concrete browser/SVG values. */
export function resolveNodeAppearance(
  _kind: NodeKind,
  authored: NodeAppearance = {},
  context: PresentationContext = { theme: DEFAULT_THEME, showKinds: true },
): ResolvedNodeAppearance {
  const font = authored.font ?? 'sans';
  const text = authored.text ?? 'ink';
  const background = authored.background ?? 'transparent';
  const borderColor = authored.borderColor ?? 'muted';
  const radius = authored.radius ?? 0;
  const badge = authored.badge ?? 'default';
  return {
    ...(authored.icon === undefined ? {} : { icon: authored.icon }),
    ...(authored.palette === undefined ? {} : { palette: authored.palette }),
    font,
    fontFamily: FONT_STACKS[font],
    fontSize: authored.size ?? 14,
    fontWeight: authored.weight ?? 400,
    textAlign: authored.align ?? 'left',
    verticalAlign: authored.verticalAlign ?? 'top',
    textColor: themeTokenColor(context.theme, text),
    backgroundColor: themeTokenColor(context.theme, background),
    borderColor: themeTokenColor(context.theme, borderColor),
    borderWidth: authored.border ?? 0,
    borderRadius: radius === 'pill' ? 999 : radius,
    padding: authored.padding ?? 0,
    badge,
    showKindBadge: badge !== 'hide' && context.showKinds,
    theme: context.theme,
  };
}
