/** Incremental geometry for semantic CLI updates: measure additions, never move survivors. */

import { reflowPresentation, reflowTopology } from '../../domain/diagram-geometry.ts';
import type { DiagramRecord } from '../../../contract/records/index.ts';
import { placementsOf } from './record-graph.ts';
import { copyMeasuredSubtree, descendantIds } from './record-insertion-slice.ts';

const GROUP_PADDING = 40;
const GROUP_TITLE_SPACE = 16;
const INSERTION_GAP = 80;

function activeLayoutId(record: DiagramRecord): string {
  return record.views[record.activeViewId].layoutId as string;
}

function insertionOrigin(
  record: DiagramRecord,
  parentId: string | undefined,
  addedIds: ReadonlySet<string>,
): { x: number; y: number } {
  const placements = placementsOf(record);
  const obstacles = Object.entries(record.nodes)
    .filter(([id, node]) => !addedIds.has(id) && (node.parentId as string | undefined) === parentId)
    .map(([id]) => placements[id])
    .filter(Boolean);
  const startY = parentId ? GROUP_PADDING + GROUP_TITLE_SPACE : INSERTION_GAP;
  return {
    x: GROUP_PADDING,
    y: obstacles.length === 0
      ? startY
      : Math.max(...obstacles.map((placement) =>
        placement.position.y + placement.size.height)) + INSERTION_GAP,
  };
}

function moveRootBlock(
  record: DiagramRecord,
  rootIds: readonly string[],
  origin: { x: number; y: number },
): void {
  const placements = placementsOf(record);
  const left = Math.min(...rootIds.map((id) => placements[id].position.x));
  const top = Math.min(...rootIds.map((id) => placements[id].position.y));
  for (const id of rootIds) {
    const placement = placements[id];
    placements[id] = {
      ...placement,
      position: {
        x: placement.position.x + origin.x - left,
        y: placement.position.y + origin.y - top,
      },
    };
  }
}

function growAncestors(record: DiagramRecord, childIds: readonly string[]): void {
  const placements = placementsOf(record);
  for (const childId of childIds) {
    let currentId = childId;
    let parentId = record.nodes[currentId]?.parentId as string | undefined;
    while (parentId) {
      const child = placements[currentId];
      const parent = placements[parentId];
      if (!child || !parent) break;
      placements[parentId] = {
        ...parent,
        size: {
          width: Math.max(parent.size.width, child.position.x + child.size.width + GROUP_PADDING),
          height: Math.max(parent.size.height, child.position.y + child.size.height + GROUP_PADDING),
        },
      };
      currentId = parentId;
      parentId = record.nodes[currentId]?.parentId as string | undefined;
    }
  }
}

function layoutAddedSubtrees(
  before: DiagramRecord,
  target: DiagramRecord,
  addedIds: readonly string[],
): void {
  const added = new Set(addedIds);
  const roots = addedIds.filter((id) => {
    const parentId = target.nodes[id].parentId as string | undefined;
    return !parentId || !added.has(parentId);
  });
  const byParent = new Map<string | undefined, string[]>();
  for (const id of roots) {
    const parentId = target.nodes[id].parentId as string | undefined;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), id]);
  }
  let ordinal = 0;
  for (const [parentId, rootIds] of byParent) {
    const nodeIds = descendantIds(target, rootIds, added);
    copyMeasuredSubtree(target, rootIds, nodeIds, ordinal);
    moveRootBlock(target, rootIds, insertionOrigin(before, parentId, added));
    growAncestors(target, rootIds);
    ordinal += 1;
  }
}

function nodeChanged(before: DiagramRecord, target: DiagramRecord, id: string): boolean {
  return JSON.stringify(before.nodes[id]) !== JSON.stringify(target.nodes[id]);
}

function changedAutoSizedIds(before: DiagramRecord, target: DiagramRecord): string[] {
  const previousPlacements = placementsOf(before);
  return Object.keys(target.nodes).filter((id) => before.nodes[id]
    && target.nodes[id].kind !== 'group'
    && previousPlacements[id]?.sizeMode !== 'manual'
    && nodeChanged(before, target, id));
}

function changedArrangementIds(before: DiagramRecord, target: DiagramRecord): string[] {
  const previous = before.layouts[activeLayoutId(before)].arrangementByContainerId ?? {};
  const next = target.layouts[activeLayoutId(target)].arrangementByContainerId ?? {};
  return Object.keys(next).filter((id) => JSON.stringify(previous[id]) !== JSON.stringify(next[id]));
}

function topologyChanged(before: DiagramRecord, target: DiagramRecord): boolean {
  const ids = new Set([...Object.keys(before.nodes), ...Object.keys(target.nodes)]);
  return [...ids].some((id) => before.nodes[id]?.band !== target.nodes[id]?.band
    || before.nodes[id]?.lane !== target.nodes[id]?.lane);
}

/**
 * Reconciles geometry for an existing compiled map.
 *
 * Surviving placements start as exact copies. New subtree roots are measured in isolated
 * synthetic diagrams and appended after existing sibling bounds. Established presentation
 * reflow then owns only changed auto sizes and explicitly changed arrangements.
 */
export function placeCompiledInsertions(
  before: DiagramRecord,
  target: DiagramRecord,
): DiagramRecord {
  const next = structuredClone(target);
  const addedIds = Object.keys(next.nodes).filter((id) => !before.nodes[id]);
  layoutAddedSubtrees(before, next, addedIds);
  const resizedNodeIds = changedAutoSizedIds(before, next);
  const arrangementAffectedIds = changedArrangementIds(before, next);
  const reflowed = resizedNodeIds.length || arrangementAffectedIds.length
    ? reflowPresentation(next, { resizedNodeIds, arrangementAffectedIds })
    : next;
  return topologyChanged(before, next) ? reflowTopology(reflowed) : reflowed;
}
