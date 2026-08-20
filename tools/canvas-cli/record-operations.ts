/** Computes record command batches without reading or writing storage. */

import type { DiagramRecord, RecordCommand } from '../../src/canvas.ts';
import { contentFieldsFor } from '../../src/components/registry.ts';
import {
  asId, placementsOf, type PlacedNode, type RecordNode,
} from './record-graph.ts';
import { PLACEHOLDER } from './record-target.ts';

function depthOf(nodes: Record<string, RecordNode>, id: string): number {
  let depth = 0;
  let cursor = nodes[id]?.parentId as string | undefined;
  while (cursor && depth < 64) {
    depth += 1;
    cursor = nodes[cursor]?.parentId as string | undefined;
  }
  return depth;
}

function structurallyEqual(left: RecordNode, right: RecordNode): boolean {
  const componentContentMatches = left.kind === right.kind
    && Object.keys(contentFieldsFor(left.kind)).every((field) =>
      JSON.stringify((left as unknown as Record<string, unknown>)[field] ?? null)
      === JSON.stringify((right as unknown as Record<string, unknown>)[field] ?? null));
  return left.kind === right.kind
    && left.parentId === right.parentId
    && JSON.stringify(left.interfaceIds) === JSON.stringify(right.interfaceIds)
    && JSON.stringify(left.typeIds) === JSON.stringify(right.typeIds)
    && componentContentMatches
    && JSON.stringify(left.subjectRef ?? null) === JSON.stringify(right.subjectRef ?? null)
    && left.expandsToDiagramId === right.expandsToDiagramId;
}

function sameWires(left: DiagramRecord['wires'], right: DiagramRecord['wires']): boolean {
  const key = (wires: DiagramRecord['wires']): string => JSON.stringify(
    Object.values(wires)
      .map((wire) => [wire.id, wire.kind, wire.label, wire.source.nodeId, wire.target.nodeId])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  return key(left) === key(right);
}

/** Expresses the difference between a stored record and a target as one ordered command batch. */
export function commandsFor(before: DiagramRecord, target: DiagramRecord): RecordCommand[] {
  const placements = placementsOf(target);
  const previous = placementsOf(before);
  const commands: RecordCommand[] = [];
  const removedIds = Object.keys(before.nodes).filter((id) => !target.nodes[id]);
  const addedIds = Object.keys(target.nodes).filter((id) => !before.nodes[id]);
  const survivingIds = Object.keys(target.nodes).filter((id) => before.nodes[id]);
  const rebuiltIds = survivingIds.filter((id) => !structurallyEqual(before.nodes[id], target.nodes[id]));
  const rebuildWires = removedIds.length > 0 || addedIds.length > 0 || rebuiltIds.length > 0
    || !sameWires(before.wires, target.wires);

  if (before.name !== target.name) commands.push({ kind: 'diagram.rename', name: target.name });
  if (rebuildWires) {
    for (const wire of Object.values(before.wires)) commands.push({ kind: 'wire.remove', id: wire.id as string });
  }
  for (const id of [...removedIds, ...rebuiltIds]
    .sort((a, b) => depthOf(before.nodes, b) - depthOf(before.nodes, a))) {
    commands.push({ kind: 'node.remove', id });
  }
  for (const id of [...addedIds, ...rebuiltIds]
    .sort((a, b) => depthOf(target.nodes, a) - depthOf(target.nodes, b))) {
    const placement = placements[id] ?? { ...PLACEHOLDER, nodeId: asId(id) };
    commands.push({
      kind: 'node.add', node: target.nodes[id],
      placement: { position: placement.position, size: placement.size },
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
    const now = placements[id];
    const was = previous[id];
    if (now && was) {
      if (now.position.x !== was.position.x || now.position.y !== was.position.y) {
        commands.push({ kind: 'node.move', id, position: now.position });
      }
      if (now.size.width !== was.size.width || now.size.height !== was.size.height) {
        commands.push({ kind: 'node.resize', id, size: now.size });
      }
    }
  }
  if (rebuildWires) {
    for (const wire of Object.values(target.wires)) commands.push({ kind: 'wire.add', wire });
  }
  const beforeLayout = before.layouts[before.views[before.activeViewId].layoutId];
  const targetLayout = target.layouts[target.views[target.activeViewId].layoutId];
  const beforePresentation = {
    appearanceByNodeId: beforeLayout.appearanceByNodeId ?? {},
    appearanceByWireId: beforeLayout.appearanceByWireId ?? {},
    arrangementByContainerId: beforeLayout.arrangementByContainerId ?? {},
  };
  const targetPresentation = {
    appearanceByNodeId: targetLayout.appearanceByNodeId ?? {},
    appearanceByWireId: targetLayout.appearanceByWireId ?? {},
    arrangementByContainerId: targetLayout.arrangementByContainerId ?? {},
  };
  if (JSON.stringify(beforePresentation) !== JSON.stringify(targetPresentation)) {
    commands.push({ kind: 'layout.presentation.replace', ...targetPresentation });
  }
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
