import type { SnapshotScene } from './contract.ts';

/** Fixed snapshot palette and typography shared by every SVG rendering phase. */
export const SNAPSHOT_STYLE = {
  colors: {
    page: '#0d0d0f',
    panel: '#1b1b1e',
    card: '#252529',
    ink: '#ececee',
    muted: '#a2a2aa',
    faint: '#8b8b94',
    gold: '#d0a14b',
    danger: '#c26d5a',
    border: '#2f2f34',
  },
  font: 'Inter, sans-serif',
  margin: 24,
} as const;

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
  const { colors, font } = SNAPSHOT_STYLE;
  const { panel, total, scope } = scene;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total.width}" height="${total.height}" viewBox="0 0 ${total.width} ${total.height}">`,
    `<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="${colors.faint}"/></marker></defs>`,
    `<rect x="0" y="0" width="${total.width}" height="${total.height}" fill="${colors.page}"/>`,
    `<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${colors.panel}" stroke="${colors.border}" rx="6"/>`,
    `<text x="${panel.x + 20}" y="${panel.y + 32}" fill="${colors.gold}" font-family="${font}" font-size="15" font-weight="600">${escapeSvg(scope.label)}</text>`,
  ];
}
