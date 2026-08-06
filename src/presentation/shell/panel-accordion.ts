/**
 * Which section of a panel is open.
 *
 * The whole anti-clutter mechanism of the Studio lives in this one function: in `accordion`
 * mode exactly one section is expanded and its siblings are one heading row each, so the most
 * a panel can ever show is one open section plus a short list of titles. `all-open` is the
 * escape hatch for anyone who wants the old everything-at-once, and it is a preference rather
 * than an argument.
 *
 * Pure and framework-free: the panels ask it, and so do the tests, so what is on screen and
 * what is asserted cannot drift apart.
 */

/** How a panel body distributes its sections. */
export type SectionMode = 'accordion' | 'all-open';

/** Answers "is this section expanded" for one panel, one mode, one remembered toggle. */
export type SectionOpenTest = (sectionId: string) => boolean;

/**
 * Builds the open-test for a panel.
 *
 * `toggled` is the section the user last opened, or `null` when they have not touched this
 * panel yet. An unknown or retired id falls back to the first section rather than leaving the
 * panel with nothing open, because a body showing only headings reads as broken.
 */
export function resolveOpenSection(
  mode: SectionMode,
  sections: readonly string[],
  toggled: string | null,
): SectionOpenTest {
  if (mode === 'all-open') return () => true;
  const open = toggled !== null && sections.includes(toggled) ? toggled : sections[0];
  return (sectionId: string) => sectionId === open;
}
