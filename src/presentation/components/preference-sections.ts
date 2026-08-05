import type { PreferenceSection } from '../../domain/model';

/** The preference categories, in the order the Studio offers them. */
export const PREFERENCE_SECTIONS: readonly PreferenceSection[] = [
  'theme', 'canvas', 'nodes', 'wires', 'panel', 'files',
];

/** One line per category — the only place preferences explain themselves. */
const SECTION_META: Record<PreferenceSection, string> = {
  theme: 'Colour, accent, and corner shape',
  canvas: 'Grid, controls, and breathing room',
  nodes: 'What an object shows on the canvas',
  wires: 'How relationships are drawn',
  panel: 'How this panel behaves',
  files: 'When your work reaches disk',
};

export function preferenceSectionMeta(section: PreferenceSection): string {
  return SECTION_META[section];
}
