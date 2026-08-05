import type { ArchitectureDocument } from './model';

/** Small map identity used by presentation adapters. */
export interface ArchitectureMap {
  id: string;
  label: string;
}

/** Lists the document's named top-level maps in stable document order. */
export function listArchitectureMaps(document: ArchitectureDocument): ArchitectureMap[] {
  return Object.values(document.nodes)
    .filter((node) => node.kind === 'scope' && !node.parentId)
    .map((node) => ({ id: node.id, label: node.label }));
}

/** Resolves a requested map, falling back to the document's first map. */
export function resolveArchitectureMap(
  document: ArchitectureDocument,
  requestedId: string | undefined,
): string | undefined {
  const maps = listArchitectureMaps(document);
  return maps.some((map) => map.id === requestedId) ? requestedId : maps[0]?.id;
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
  if (!mapId || document.nodes[mapId]?.kind !== 'scope') return document;
  const nodeIds = descendantIds(document, mapId);
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
