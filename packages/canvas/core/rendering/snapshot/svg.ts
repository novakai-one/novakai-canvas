import type { ResolvedCanvasTheme } from '../../../contract/records/preferences.ts';
import type { SnapshotScene } from './contract.ts';
import { mixThemeColors } from '../../domain/theme-resolver.ts';

export const SNAPSHOT_MARGIN = 24;

export interface SnapshotStyle {
  colors: {
    page: string;
    panel: string;
    card: string;
    ink: string;
    muted: string;
    faint: string;
    accent: string;
    danger: string;
    border: string;
  };
  font: string;
}

/** Adapts the shared resolved palette to snapshot-specific names. */
export function snapshotStyle(theme: ResolvedCanvasTheme): SnapshotStyle {
  return {
    colors: {
      page: theme.colors.canvas,
      panel: theme.colors.panel,
      card: theme.colors.surface,
      ink: theme.colors.text,
      muted: theme.colors.muted,
      faint: mixThemeColors(theme.colors.muted, theme.colors.canvas, 0.22),
      accent: theme.colors.accent,
      danger: theme.semantic.danger,
      border: theme.colors.border,
    },
    font: 'Inter, sans-serif',
  };
}

/** Escapes authored text before interpolation into SVG markup. */
export function escapeSvg(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Wraps plain text using the snapshot renderer's stable character approximation. */
export function wrapText(text: string, charsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > charsPerLine && current.length > 0) {
      lines.push(current);
      current = word;
    } else current = current.length > 0 ? `${current} ${word}` : word;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Emits the SVG root, marker, page, panel and scope title in canonical order. */
export function renderSvgFrame(scene: SnapshotScene): string[] {
  const { colors, font } = scene.style;
  const { panel, total, scope } = scene;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total.width}" height="${total.height}" viewBox="0 0 ${total.width} ${total.height}">`,
    `<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${colors.faint}"/></marker></defs>`,
    `<rect x="0" y="0" width="${total.width}" height="${total.height}" fill="${colors.page}"/>`,
    `<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${colors.panel}" stroke="${colors.border}" rx="6"/>`,
    `<text x="${panel.x + 20}" y="${panel.y + 32}" fill="${colors.accent}" font-family="${font}" font-size="15" font-weight="600">${escapeSvg(scope.label)}</text>`,
  ];
}
