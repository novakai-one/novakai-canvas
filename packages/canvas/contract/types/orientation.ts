/** The permitted diagram orientations, in authoring-display order. */
export const ORIENTATIONS = ['top-down', 'left-right'] as const;

/** One declared direction for the whole diagram. */
export type Orientation = typeof ORIENTATIONS[number];

/** Narrows authoring input to the orientation vocabulary. */
export function isOrientation(value: string): value is Orientation {
  return (ORIENTATIONS as readonly string[]).includes(value);
}
