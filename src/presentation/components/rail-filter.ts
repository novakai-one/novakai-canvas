import type { DiagramSummary } from '../../application/canvas-library';

/** The rail's two groups: what you work in, and what you have put away. */
export interface RailGroups {
  active: DiagramSummary[];
  archived: DiagramSummary[];
}

/**
 * Groups the library for the rail, narrowed by what has been typed.
 *
 * Two rules the rail depends on. The open diagram always survives the filter — typing must
 * never make the thing you are looking at disappear from the list that says where you are. And
 * the filter reads the objects inside a diagram as well as its name, because the question is
 * usually "where does the session broker live", not "what was that diagram called".
 */
export function groupDiagrams(
  diagrams: readonly DiagramSummary[],
  query: string,
  activeId: string,
): RailGroups {
  const needle = query.trim().toLowerCase();
  const matches = (entry: DiagramSummary): boolean => entry.id === activeId
    || needle.length === 0
    || entry.name.toLowerCase().includes(needle)
    || entry.nodeLabels.some((label) => label.toLowerCase().includes(needle));
  const byName = (left: DiagramSummary, right: DiagramSummary): number =>
    left.name.localeCompare(right.name);
  const listed = diagrams.filter(matches);
  return {
    active: listed.filter((entry) => entry.status === 'active').sort(byName),
    archived: listed.filter((entry) => entry.status === 'archived').sort(byName),
  };
}
