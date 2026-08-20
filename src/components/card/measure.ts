/**
 * The canonical card sizing rule: a generous stored size that prevents presentation adapters
 * clipping content.
 *
 * Lives here (not in `src/domain/layout.ts`) so component measurement remains independent of
 * whole-document layout. The CLI's stable layout adapter re-exports it directly.
 */

import type { Size } from '../component.ts';

const CHAR_WIDTH = 7.2;

export function estimateNodeSize(
  label: string,
  description: string | undefined,
  interfaceLines: string[],
  typeLines: string[],
): Size {
  const longestLine = Math.max(
    label.length,
    ...interfaceLines.map((line) => line.length),
    ...typeLines.map((line) => line.length),
    description ? Math.min(description.length, 55) : 0,
  );
  const width = Math.min(420, Math.max(200, Math.round(24 + CHAR_WIDTH * longestLine)));
  const charsPerLine = Math.max(30, Math.floor(width / CHAR_WIDTH));
  const descriptionBlock = description ? 24 + 16 * Math.ceil(description.length / charsPerLine) : 0;
  const height = 48 + descriptionBlock + 26 * interfaceLines.length + 24 * typeLines.length + 16;
  return { width, height };
}
