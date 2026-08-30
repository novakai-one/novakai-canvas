/**
 * The render-side view of node appearance: every stored gap filled, ready for measurement
 * and both render hosts. Colour fields arrive as concrete CSS from `resolveNodeAppearance`
 * in core/domain; the stored record it starts from lives in `node-appearance.ts`.
 */
import type { IconName } from '../records/components.ts';
import type { ResolvedCanvasTheme } from '../records/preferences.ts';
import type {
  Badge, BorderWidth, ComponentPalette, FontFamily, FontSize, FontWeight, ResolvedNodeShape,
  Spacing, TextAlign, VerticalAlign,
} from './node-appearance.ts';

export type BlockIcon = IconName;

export interface PresentationContext { theme: ResolvedCanvasTheme; showKinds: boolean }

/** Concrete card colour slots shared by browser CSS variables and SVG attributes. */
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

/** Concrete values consumed verbatim by measurement and both render hosts. */
export interface ResolvedNodeAppearance {
  icon?: BlockIcon;
  shape: ResolvedNodeShape;
  font: FontFamily;
  fontFamily: string;
  fontSize: FontSize;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: BorderWidth;
  borderRadius: number;
  padding: Spacing;
  badge: Badge;
  showKindBadge: boolean;
  palette?: ComponentPalette;
  /** Card colour slots from the authored palette or the kind's default; absent = plain card. */
  paletteColors?: ComponentPaletteColors;
  theme: ResolvedCanvasTheme;
}
