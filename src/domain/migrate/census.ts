import type { ArchitectureDocument } from '../model';

/**
 * A structure-independent census of everything a migration must preserve.
 *
 * Deliberately keyed on identity and content rather than shape: the record model may move a
 * fact from one container to another, but it may never lose it. Two censuses comparing equal
 * is the losslessness proof — a census that only counted nodes would pass while silently
 * dropping a wire's meaning.
 */
export interface CanvasCensus {
  /** Display names of every diagram, sorted. Root scope labels become diagram names. */
  diagramNames: string[];
  /** Labels of every node that remains a node, sorted. Excludes nodes promoted to diagrams. */
  nodeLabels: string[];
  /** One signature per wire: kind, label, and endpoint IDs. Endpoint IDs survive migration. */
  wireSignatures: string[];
  /** Every interface ID with its owning node, sorted. */
  interfaceSignatures: string[];
  /** Every shared type ID, sorted. */
  typeIds: string[];
  /** Geometry per node ID, as an exact string. Any drift in a placement changes this. */
  placements: Record<string, string>;
  /** Idempotency history that must survive so replayed operations stay recognised. */
  appliedOperationIds: string[];
}

function geometry(x: number, y: number, width: number, height: number): string {
  return `${x},${y},${width},${height}`;
}

/**
 * Censuses a legacy (schemaVersion 2) document.
 *
 * Both real input shapes reach this function: schemaVersion 1 files are migrated to 2 by
 * `parseArchitectureDocument` first, so there is one census path rather than one per version.
 */
export function censusOfLegacyDocument(document: ArchitectureDocument): CanvasCensus {
  const diagramRootIds = new Set(Object.values(document.diagrams).map((diagram) => diagram.rootNodeId));
  const layout = document.layouts[document.activeLayoutId];

  return {
    diagramNames: Object.values(document.diagrams)
      .map((diagram) => document.nodes[diagram.rootNodeId]?.label ?? diagram.id)
      .sort(),
    nodeLabels: Object.values(document.nodes)
      .filter((node) => !diagramRootIds.has(node.id))
      .map((node) => node.label)
      .sort(),
    wireSignatures: Object.values(document.wires)
      .map((wire) => `${wire.kind}|${wire.label}|${wire.source}>${wire.target}`)
      .sort(),
    interfaceSignatures: Object.values(document.interfaces)
      .map((object) => `${object.ownerId}.${object.id}:${object.name}`)
      .sort(),
    typeIds: Object.keys(document.types).sort(),
    placements: Object.fromEntries(Object.values(layout?.placements ?? {})
      .map((placement) => [
        placement.nodeId,
        geometry(placement.position.x, placement.position.y, placement.size.width, placement.size.height),
      ])),
    appliedOperationIds: Object.keys(document.appliedOperations).sort(),
  };
}
