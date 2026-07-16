import type { Edge, Node } from '@xyflow/react';
import type {
  ArchitectureDocument, CanvasNode, CanvasPreferences, InterfaceObject, Selection, TypeObject,
} from '../domain/model';

/** Presentation data required by architecture nodes. */
export interface ArchitectureNodeData extends Record<string, unknown> {
  node: CanvasNode;
  interfaces: InterfaceObject[];
  types: TypeObject[];
  preferences: CanvasPreferences;
  selection: Selection;
  select: (selection: Selection) => void;
}

/** Presentation data required by elbow wires. */
export interface ArchitectureEdgeData extends Record<string, unknown> {
  label: string;
  preferences: CanvasPreferences;
  select: () => void;
}

function selectedOwner(document: ArchitectureDocument, selection: Selection): string | null {
  if (!selection) return null;
  if (selection.kind === 'node') return selection.id;
  if (selection.kind === 'interface') return document.interfaces[selection.id]?.ownerId ?? null;
  if (selection.kind === 'type') {
    return Object.values(document.nodes).find((node) => node.typeIds.includes(selection.id))?.id ?? null;
  }
  return null;
}

function connectedIds(document: ArchitectureDocument, selection: Selection): Set<string> {
  const owner = selectedOwner(document, selection);
  if (!selection || (!owner && selection.kind !== 'wire')) return new Set();
  if (selection.kind === 'wire') {
    const wire = document.wires[selection.id];
    return wire ? new Set([wire.source, wire.target]) : new Set();
  }
  const ids = new Set([owner as string]);
  Object.values(document.wires).forEach((wire) => {
    if (wire.source === owner) ids.add(wire.target);
    if (wire.target === owner) ids.add(wire.source);
  });
  return ids;
}

/** Projects canonical nodes into React Flow nodes. */
export function projectNodes(
  document: ArchitectureDocument,
  preferences: CanvasPreferences,
  selection: Selection,
  select: (next: Selection) => void,
): Node<ArchitectureNodeData>[] {
  const connected = connectedIds(document, selection);
  return Object.values(document.nodes).map((node) => ({
    id: node.id,
    type: node.kind === 'comment' ? 'comment' : node.kind === 'scope' ? 'scope' : 'architecture',
    position: node.position,
    parentId: node.parentId,
    extent: node.parentId ? 'parent' : undefined,
    width: node.size.width,
    height: node.size.height,
    selected: selection?.kind === 'node' && selection.id === node.id,
    className: preferences.wires.dimUnrelated && selection && !connected.has(node.id) && node.kind !== 'scope'
      ? 'is-dimmed'
      : '',
    zIndex: node.kind === 'scope' ? -1 : node.kind === 'comment' ? 3 : 2,
    data: {
      node,
      interfaces: node.interfaceIds.flatMap((id) => document.interfaces[id] ? [document.interfaces[id]] : []),
      types: node.typeIds.flatMap((id) => document.types[id] ? [document.types[id]] : []),
      preferences,
      selection,
      select,
    },
  }));
}

/** Projects canonical wires into React Flow edges. */
export function projectEdges(
  document: ArchitectureDocument,
  preferences: CanvasPreferences,
  selection: Selection,
  select: (next: Selection) => void,
): Edge<ArchitectureEdgeData>[] {
  const connected = connectedIds(document, selection);
  return Object.values(document.wires).map((wire) => ({
    id: wire.id,
    source: wire.source,
    target: wire.target,
    type: 'elbow',
    selected: selection?.kind === 'wire' && selection.id === wire.id,
    className: preferences.wires.dimUnrelated && selection
      && (!connected.has(wire.source) || !connected.has(wire.target)) ? 'is-dimmed' : '',
    data: { label: wire.label, preferences, select: () => select({ kind: 'wire', id: wire.id }) },
  }));
}
