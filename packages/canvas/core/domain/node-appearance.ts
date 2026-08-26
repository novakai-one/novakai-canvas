import type { NodeKind } from '../../contract/types/node-kind.ts';
import type {
  FontFamily, NodeAppearance, PresentationContext, ResolvedNodeAppearance,
} from '../../contract/schemas/node-appearance.ts';

const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'SFMono-Regular, Consolas, monospace',
};

const TOKEN_COLORS = {
  dark: {
    ink: '#ececee', muted: '#a2a2aa', green: '#78a886', blue: '#7f9fc7',
    violet: '#a08ac8', rose: '#c08a98', amber: '#d0a14b', surface: '#252529',
    'green-soft': '#1b261f', 'blue-soft': '#1b222b', 'violet-soft': '#241f2b',
    'rose-soft': '#2a2024', 'amber-soft': '#2b2519', transparent: 'transparent',
  },
  light: {
    ink: '#26262a', muted: '#5f5f66', green: '#4f7b5b', blue: '#4e6f99',
    violet: '#6f579c', rose: '#925867', amber: '#9a6f24', surface: '#ffffff',
    'green-soft': '#e8f1e9', 'blue-soft': '#e8eef6', 'violet-soft': '#eee9f7',
    'rose-soft': '#f6e9ed', 'amber-soft': '#f7efdf', transparent: 'transparent',
  },
} as const;

/** The single owner of defaults and concrete browser/SVG values. */
export function resolveNodeAppearance(
  _kind: NodeKind,
  authored: NodeAppearance = {},
  context: PresentationContext = { theme: 'dark', showKinds: true },
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
    textColor: TOKEN_COLORS[context.theme][text],
    backgroundColor: TOKEN_COLORS[context.theme][background],
    borderColor: TOKEN_COLORS[context.theme][borderColor],
    borderWidth: authored.border ?? 0,
    borderRadius: radius === 'pill' ? 999 : radius,
    padding: authored.padding ?? 0,
    badge,
    showKindBadge: badge !== 'hide' && context.showKinds,
    theme: context.theme,
  };
}
