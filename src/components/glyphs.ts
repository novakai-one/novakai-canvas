/** Shared outline artwork for the closed semantic icon vocabulary. */

import { ICON_NAMES, type IconName } from '../domain/model.ts';

export const GLYPH_NAMES = ICON_NAMES;

/** One 24×24 outline path per semantic icon. */
export const GLYPHS = {
  check: 'M5 12l4 4L19 6',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 7v5l3 2',
  people: 'M8 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6M3 20c0-4 2-6 5-6s5 2 5 6M16 11a3 3 0 1 0 0-6M15 14c4 0 6 2 6 6',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10c-4-2-7-5-7-10V6z',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10M12 11v2',
  trend: 'M4 17l5-5 4 4 7-8M15 8h5v5',
} satisfies Record<IconName, string>;
