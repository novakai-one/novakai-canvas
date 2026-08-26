/**
 * The canonical card sizing rule: a generous stored size that prevents presentation adapters
 * clipping content.
 *
 * Lives here (not in diagram geometry) so component measurement remains independent of
 * whole-document layout. The CLI's stable layout adapter re-exports it directly.
 */

import type { Size } from '../component.ts';

const CHAR_WIDTH = 7.2;
const CARD_HEADER_HEIGHT = 48;
const INTERFACE_ROW_HEIGHT = 26;
const AUTO_MIN_WIDTH = 240;
const AUTO_MAX_WIDTH = 300;

function descriptionHeight(description: string | undefined, width: number): number {
  if (!description) return 0;
  const charsPerLine = Math.max(30, Math.floor(width / CHAR_WIDTH));
  return 24 + 16 * Math.ceil(description.length / charsPerLine);
}

/** Canonical centre of a rendered interface row, measured from the card's top edge. */
export function interfaceRowCenter(
  description: string | undefined,
  width: number,
  ordinal: number,
): number {
  return CARD_HEADER_HEIGHT + descriptionHeight(description, width)
    + INTERFACE_ROW_HEIGHT * ordinal + INTERFACE_ROW_HEIGHT / 2;
}

export function estimateNodeSize(
  label: string,
  description: string | undefined,
  interfaceLines: string[],
  typeLines: string[],
  availableWidth?: number,
): Size {
  const longestLine = Math.max(
    label.length,
    ...interfaceLines.map((line) => line.length),
    ...typeLines.map((line) => line.length),
    description ? Math.min(description.length, 55) : 0,
  );
  const automaticWidth = Math.min(
    AUTO_MAX_WIDTH,
    Math.max(AUTO_MIN_WIDTH, Math.round(24 + CHAR_WIDTH * longestLine)),
  );
  const width = availableWidth === undefined ? automaticWidth : Math.max(1, availableWidth);
  const descriptionBlock = descriptionHeight(description, width);
  const height = CARD_HEADER_HEIGHT + descriptionBlock
    + INTERFACE_ROW_HEIGHT * interfaceLines.length + 24 * typeLines.length + 16;
  return { width, height };
}
