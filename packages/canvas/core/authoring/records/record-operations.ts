/** Computes record command batches without reading or writing storage. */

import type { RecordCommand } from '../../../contract/workspace-commands.ts';
import type { DiagramRecord } from '../../../contract/records/index.ts';
import {
  asId, PLACEHOLDER_PLACEMENT, placementsOf, type PlacedNode, type RecordNode,
} from './record-graph.ts';
import {
  activeFlow, activeLayout, depthOf, placementInput, presentationOf,
  sameDefinitions, sameFlows, sameWires, structurallyEqual,
} from './record-comparison.ts';

function routeRestoreCommands(target: DiagramRecord, restore: boolean): RecordCommand[] {
  if (!restore) return [];
  const hints = activeLayout(target).wireRouteHints;
  return Object.keys(target.wires).flatMap((wireId) => {
    const hint = hints[wireId];
    if (!hint) return [];
    return [{
      kind: 'wire.setRoute' as const,
      id: wireId,
      route: {
        waypoints: hint.waypoints,
        ...(hint.labelPosition === undefined ? {} : { labelPosition: hint.labelPosition }),
        ...(hint.preferredSourceSide ? { preferredSourceSide: hint.preferredSourceSide } : {}),
        ...(hint.preferredTargetSide ? { preferredTargetSide: hint.preferredTargetSide } : {}),
      },
    }];
  });
}

function finalGeometryCommands(
  before: DiagramRecord,
  target: DiagramRecord,
  forcedIds: ReadonlySet<string>,
): RecordCommand[] {
  const previous = placementsOf(before);
  const placements = placementsOf(target);
  const ids = Object.keys(target.nodes).filter((id) => placements[id]);
  const changedSize = (id: string) => forcedIds.has(id) || !previous[id]
    || JSON.stringify(previous[id].size) !== JSON.stringify(placements[id].size)
    || previous[id].sizeMode !== placements[id].sizeMode;
  const changedPosition = (id: string) => forcedIds.has(id) || !previous[id]
    || JSON.stringify(previous[id].position) !== JSON.stringify(placements[id].position);
  const resized = ids.filter(changedSize)
    .sort((left, right) => depthOf(target.nodes, right) - depthOf(target.nodes, left))
    .map((id): RecordCommand => ({
      kind: 'node.resize', id, size: placements[id].size,
      ...(placements[id].sizeMode ? { sizeMode: placements[id].sizeMode } : {}),
    }));
  const moved = ids.filter(changedPosition)
    .map((id): RecordCommand => ({ kind: 'node.move', id, position: placements[id].position }));
  return [...resized, ...moved];
}

/** Expresses the difference between a stored record and a target as one ordered command batch. */
export function commandsFor(before: DiagramRecord, target: DiagramRecord): RecordCommand[] {
  const placements = placementsOf(target);
  const commands: RecordCommand[] = [];
  const removedIds = Object.keys(before.nodes).filter((id) => !target.nodes[id]);
  const addedIds = Object.keys(target.nodes).filter((id) => !before.nodes[id]);
  const survivingIds = Object.keys(target.nodes).filter((id) => before.nodes[id]);
  const rebuiltIds = survivingIds.filter((id) => !structurallyEqual(before.nodes[id], target.nodes[id]));
  const rebuildWires = removedIds.length > 0 || rebuiltIds.length > 0
    || !sameWires(before.wires, target.wires);
  const beforeFlow = activeFlow(before);
  const targetFlow = activeFlow(target);

  if (beforeFlow && beforeFlow !== targetFlow) commands.push({ kind: 'flow.activate' });

  if (before.name !== target.name) commands.push({ kind: 'diagram.rename', name: target.name });
  if (before.orientation !== target.orientation) {
    commands.push({ kind: 'diagram.setOrientation', orientation: target.orientation });
  }
  if (rebuildWires) {
    for (const wire of Object.values(before.wires)) commands.push({ kind: 'wire.remove', id: wire.id as string });
  }
  for (const id of [...removedIds, ...rebuiltIds]
    .sort((a, b) => depthOf(before.nodes, b) - depthOf(before.nodes, a))) {
    commands.push({ kind: 'node.remove', id });
  }
  for (const id of [...addedIds, ...rebuiltIds]
    .sort((a, b) => depthOf(target.nodes, a) - depthOf(target.nodes, b))) {
    const placement = placements[id] ?? { ...PLACEHOLDER_PLACEMENT, nodeId: asId(id) };
    commands.push({
      kind: 'node.add', node: target.nodes[id],
      placement: placementInput(placement),
    });
  }
  if (!sameDefinitions(before, target)) {
    commands.push({
      kind: 'diagram.definitions.replace',
      interfaces: target.interfaces,
      types: target.types,
    });
  }
  const rebuilt = new Set(rebuiltIds);
  for (const id of survivingIds) {
    if (rebuilt.has(id)) continue;
    const from = before.nodes[id];
    const to = target.nodes[id];
    if (from.label !== to.label || from.description !== to.description) {
      commands.push({ kind: 'node.update', id, patch: { label: to.label, description: to.description } });
    }
  }
  if (rebuildWires) {
    for (const wire of Object.values(target.wires)) commands.push({ kind: 'wire.add', wire });
  }
  if (!sameFlows(before, target)) {
    commands.push({ kind: 'diagram.flows.replace', flows: structuredClone(target.flows ?? {}) });
  }
  if (targetFlow && targetFlow !== beforeFlow) {
    commands.push({ kind: 'flow.activate', flowId: targetFlow as never });
  }
  const targetPresentation = presentationOf(target);
  if (rebuildWires || rebuiltIds.length > 0
    || JSON.stringify(presentationOf(before)) !== JSON.stringify(targetPresentation)) {
    commands.push({ kind: 'layout.presentation.replace', ...targetPresentation });
  }
  commands.push(...routeRestoreCommands(target, rebuildWires));
  const recreated = new Set([...addedIds, ...rebuiltIds]);
  for (const id of recreated) {
    if (placements[id]?.pinned) commands.push({ kind: 'node.pin', id, pinned: true });
  }
  commands.push(...finalGeometryCommands(before, target, recreated));
  return commands;
}

/** Removes one node and its descendant closure, deepest first. */
export function removalCommandsFor(record: DiagramRecord, targetId: string): RecordCommand[] {
  const doomed = new Set<string>([targetId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(record.nodes)) {
      const parentId = node.parentId as string | undefined;
      if (parentId && doomed.has(parentId) && !doomed.has(node.id as string)) {
        doomed.add(node.id as string);
        changed = true;
      }
    }
  }
  return [...doomed]
    .sort((a, b) => depthOf(record.nodes, b) - depthOf(record.nodes, a))
    .map((id) => ({ kind: 'node.remove', id } as const));
}

/** Finds a node by the author-facing label predicate. */
export function findNodeByLabel(
  nodes: Record<string, PlacedNode> | Record<string, RecordNode>,
  matches: (label: string) => boolean,
): RecordNode | undefined {
  return Object.values(nodes).find((node) => matches(node.label));
}
