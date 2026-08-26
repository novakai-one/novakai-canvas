import type { DiagramRecord } from '../../../contract/records/index.ts';

/** Direct children in semantic record order. */
export function directChildIds(record: DiagramRecord, containerId: string): string[] {
  return Object.values(record.nodes)
    .filter((node) => node.parentId === containerId)
    .map((node) => node.id as string);
}

/** Keeps authored order for survivors and appends newly direct children in record order. */
export function reconcileArrangementChildren(record: DiagramRecord, containerId: string): void {
  const childIds = directChildIds(record, containerId);
  const directChildren = new Set(childIds);
  for (const layout of Object.values(record.layouts)) {
    const arrangement = layout.arrangementByContainerId?.[containerId];
    if (!arrangement) continue;
    const seen = new Set<string>();
    const retained = arrangement.childIds.filter((childId) => {
      if (!directChildren.has(childId) || seen.has(childId)) return false;
      seen.add(childId);
      return true;
    });
    arrangement.childIds = [...retained, ...childIds.filter((childId) => !seen.has(childId))];
  }
}

/** Returns the first incomplete direct-child permutation, if one exists. */
export function arrangementCoverageFailure(record: DiagramRecord): string | undefined {
  for (const layout of Object.values(record.layouts)) {
    for (const [containerId, arrangement] of Object.entries(
      layout.arrangementByContainerId ?? {},
    )) {
      const childIds = directChildIds(record, containerId);
      const arranged = new Set(arrangement.childIds);
      if (arrangement.childIds.length !== childIds.length
        || arranged.size !== childIds.length
        || childIds.some((childId) => !arranged.has(childId))) {
        return `arrangement-must-name-every-direct-child:${containerId}`;
      }
    }
  }
  return undefined;
}
