import type { ArchitectureDocument, CanvasReference } from './model';

/** Small map identity used by presentation adapters. */
export interface ArchitectureMap {
  id: string;
  rootNodeId: string;
  label: string;
  status: 'active' | 'archived';
}

/** Lists the diagram library in stable record order; archived work is opt-in. */
export function listArchitectureMaps(
  document: ArchitectureDocument,
  includeArchived = false,
): ArchitectureMap[] {
  return Object.values(document.diagrams)
    .filter((diagram) => includeArchived || diagram.status === 'active')
    .map((diagram) => ({
      id: diagram.id,
      rootNodeId: diagram.rootNodeId,
      label: document.nodes[diagram.rootNodeId]?.label ?? diagram.id,
      status: diagram.status,
    }));
}

/** Resolves a requested map, falling back to the document's first map. */
export function resolveArchitectureMap(
  document: ArchitectureDocument,
  requestedId: string | undefined,
  includeArchived = false,
): string | undefined {
  const maps = listArchitectureMaps(document, includeArchived);
  return maps.some((map) => map.id === requestedId) ? requestedId : maps[0]?.id;
}

/** Resolves an overview occurrence's deeper explanation without guessing by label. */
export function linkedArchitectureMap(
  document: ArchitectureDocument,
  nodeId: string,
): string | undefined {
  const linkedId = document.nodes[nodeId]?.expandsToDiagramId;
  return linkedId && document.diagrams[linkedId]?.status === 'active' ? linkedId : undefined;
}

export interface SubjectOccurrence {
  diagramId: string;
  nodeId: string;
}

/** Finds every drawing occurrence of one authoritative external subject. */
export function findSubjectOccurrences(
  document: ArchitectureDocument,
  subject: CanvasReference,
): SubjectOccurrence[] {
  return Object.values(document.nodes).flatMap((node) => {
    if (node.subjectRef?.namespace !== subject.namespace || node.subjectRef.id !== subject.id) return [];
    let root = node;
    while (root.parentId && document.nodes[root.parentId]) root = document.nodes[root.parentId];
    const diagram = Object.values(document.diagrams).find((item) => item.rootNodeId === root.id);
    return diagram ? [{ diagramId: diagram.id, nodeId: node.id }] : [];
  });
}

function descendantIds(document: ArchitectureDocument, rootId: string): Set<string> {
  const included = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(document.nodes)) {
      if (node.parentId && included.has(node.parentId) && !included.has(node.id)) {
        included.add(node.id);
        changed = true;
      }
    }
  }
  return included;
}

/** Projects one complete map while preserving the document's canonical facts. */
export function focusArchitecture(
  document: ArchitectureDocument,
  mapId: string | undefined,
): ArchitectureDocument {
  if (!mapId) return document;
  const diagram = document.diagrams[mapId];
  const rootId = diagram?.rootNodeId ?? mapId;
  if (document.nodes[rootId]?.kind !== 'scope') return document;
  let nodeIds = descendantIds(document, rootId);
  const collapsed = new Set(document.layouts[document.activeLayoutId]?.collapsedNodeIds ?? []);
  for (const collapsedId of collapsed) {
    if (!nodeIds.has(collapsedId)) continue;
    const hidden = descendantIds(document, collapsedId);
    hidden.delete(collapsedId);
    nodeIds = new Set([...nodeIds].filter((id) => !hidden.has(id)));
  }
  const nodes = Object.fromEntries(Object.entries(document.nodes).filter(([id]) => nodeIds.has(id)));
  const interfaceIds = new Set(Object.values(nodes).flatMap((node) => node.interfaceIds));
  const typeIds = new Set(Object.values(nodes).flatMap((node) => node.typeIds));
  return {
    ...document,
    nodes,
    interfaces: Object.fromEntries(Object.entries(document.interfaces).filter(([id]) => interfaceIds.has(id))),
    types: Object.fromEntries(Object.entries(document.types).filter(([id]) => typeIds.has(id))),
    wires: Object.fromEntries(Object.entries(document.wires).filter(([, wire]) =>
      nodeIds.has(wire.source) && nodeIds.has(wire.target))),
    layouts: Object.fromEntries(Object.entries(document.layouts).map(([layoutId, layout]) => [layoutId, {
      ...layout,
      placements: Object.fromEntries(Object.entries(layout.placements).filter(([nodeId]) => nodeIds.has(nodeId))),
      wireRouteHints: Object.fromEntries(Object.entries(layout.wireRouteHints).filter(([wireId]) => {
        const wire = document.wires[wireId];
        return wire && nodeIds.has(wire.source) && nodeIds.has(wire.target);
      })),
    }])),
  };
}

/** Derives the same saved map for read-only presentation; mode never changes layout. */
export function presentArchitecture(
  document: ArchitectureDocument,
  mapId: string | undefined,
): ArchitectureDocument {
  return focusArchitecture(document, mapId);
}
