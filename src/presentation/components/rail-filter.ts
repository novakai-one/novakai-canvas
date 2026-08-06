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
/** One object a search found, and the diagram it lives in. */
export interface ObjectHit {
  label: string;
  diagramId: string;
  diagramName: string;
}

/**
 * The objects a query names, across the whole library.
 *
 * Narrowing the diagram list already used object labels, but it only ever answered "which
 * diagrams" — the object that caused the match stayed invisible, which is why the control read
 * as a filter rather than a search. These are the matches themselves, so the answer to "where
 * does the session broker live" is on screen rather than inferred.
 *
 * Capped, and the caller is told when it capped: a silent truncation reads as "that is
 * everything" when it is not.
 */
export function findObjects(
  diagrams: readonly DiagramSummary[],
  query: string,
  limit = 12,
): { hits: ObjectHit[]; total: number } {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return { hits: [], total: 0 };
  const all: ObjectHit[] = [];
  for (const entry of diagrams) {
    for (const label of entry.nodeLabels) {
      if (label.toLowerCase().includes(needle)) {
        all.push({ label, diagramId: entry.id, diagramName: entry.name });
      }
    }
  }
  all.sort((left, right) => left.label.localeCompare(right.label)
    || left.diagramName.localeCompare(right.diagramName));
  return { hits: all.slice(0, limit), total: all.length };
}

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
