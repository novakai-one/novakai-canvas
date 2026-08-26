/** Selection relationships shared by node and wire projection. */

import { componentFor } from '@novakai/canvas';
import type { DiagramRecord } from '@novakai/canvas';
import type { Selection } from '@novakai/canvas';
import type { ProjectionInput } from './projection-contract';

function selectedOwner(record: DiagramRecord, selection: Selection): string | null {
  if (!selection) return null;
  if (selection.kind === 'node') return selection.id;
  if (selection.kind === 'component-item') {
    const node = record.nodes[selection.nodeId];
    return node && componentFor(node.kind).items?.(node).some(
      (item) => item.collection === selection.collection && item.id === selection.itemId,
    ) ? selection.nodeId : null;
  }
  if (selection.kind === 'interface') return record.interfaces[selection.id]?.ownerId ?? null;
  if (selection.kind === 'type') {
    return Object.values(record.nodes)
      .find((node) => (node.typeIds as string[]).includes(selection.id))?.id ?? null;
  }
  return null;
}

/** Visible node IDs related to the active selection. */
export function connectedIds(input: ProjectionInput): Set<string> {
  const { record, selection, view } = input;
  const owner = selectedOwner(record, selection);
  if (!selection || (!owner && selection.kind !== 'wire')) return new Set();
  if (selection.kind === 'wire') {
    const wire = view.wires.find((candidate) => candidate.id === selection.id);
    return wire ? new Set([wire.source.nodeId as string, wire.target.nodeId as string]) : new Set();
  }
  const ids = new Set([owner as string]);
  if (record.nodes[owner as string]?.kind === 'group') {
    let grew = true;
    while (grew) {
      grew = false;
      view.nodes.forEach((node) => {
        if (node.parentId && ids.has(node.parentId as string) && !ids.has(node.id as string)) {
          ids.add(node.id as string);
          grew = true;
        }
      });
    }
  }
  view.wires.forEach((wire) => {
    if (wire.source.nodeId === owner) ids.add(wire.target.nodeId);
    if (wire.target.nodeId === owner) ids.add(wire.source.nodeId);
  });
  return ids;
}

/** Visible wire IDs that directly constitute the active selection's local neighbourhood. */
export function connectedWireIds(input: ProjectionInput): Set<string> {
  const { record, selection, view } = input;
  if (!selection) return new Set();
  if (selection.kind === 'wire') {
    return view.wires.some((wire) => wire.id === selection.id)
      ? new Set([selection.id]) : new Set();
  }
  const owner = selectedOwner(record, selection);
  if (!owner) return new Set();
  if (record.nodes[owner]?.kind !== 'group') {
    return new Set(view.wires
      .filter((wire) => wire.source.nodeId === owner || wire.target.nodeId === owner)
      .map((wire) => wire.id as string));
  }
  const relatedNodes = connectedIds(input);
  return new Set(view.wires
    .filter((wire) => relatedNodes.has(wire.source.nodeId) && relatedNodes.has(wire.target.nodeId))
    .map((wire) => wire.id as string));
}
