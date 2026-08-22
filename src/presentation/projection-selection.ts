/** Selection relationships shared by node and wire projection. */

import { componentFor } from '../components/registry';
import type { DiagramRecord } from '../domain/records';
import type { Selection } from '../domain/model';
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
