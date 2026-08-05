import type { ArchitectureDocument } from '../model';
import type { MigratedLibrary } from '../records.ts';

/**
 * A structure-independent census of everything a migration must preserve.
 *
 * Deliberately keyed on identity and content rather than shape: the record model may move a
 * fact from one container to another, but it may never lose it. Two censuses comparing equal
 * is the losslessness proof — a census that only counted nodes would pass while silently
 * dropping a wire's meaning.
 */
export interface CanvasCensus {
  /** Display names of every diagram, sorted. */
  diagramNames: string[];
  /** Labels of every node, sorted. */
  nodeLabels: string[];
  /**
   * Kind, label, description and parentage per node, sorted.
   *
   * Labels alone are too weak an oracle: 233 of 259 real nodes carry a description, and a
   * migration that dropped every one of them would still pass a label-only comparison.
   */
  nodeSignatures: string[];
  /** One signature per wire: kind, label, and endpoint IDs. Endpoint IDs survive migration. */
  wireSignatures: string[];
  /** Signatures of relationships that crossed a diagram boundary and became library links. */
  linkSignatures: string[];
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

/** `scope` and `group` are the same concept under two names, so they compare as one. */
function normalisedKind(kind: string): string {
  return kind === 'scope' ? 'group' : kind;
}

function nodeSignature(node: {
  kind: string; label: string; description?: string; parentId?: string;
}): string {
  return `${normalisedKind(node.kind)}|${node.label}|${node.description ?? ''}|${node.parentId ?? ''}`;
}

/**
 * Censuses a legacy (schemaVersion 2) document.
 *
 * Both real input shapes reach this function: schemaVersion 1 files are migrated to 2 by
 * `parseArchitectureDocument` first, so there is one census path rather than one per version.
 */
export function censusOfLegacyDocument(document: ArchitectureDocument): CanvasCensus {
  const layout = document.layouts[document.activeLayoutId];

  return {
    diagramNames: Object.values(document.diagrams)
      .map((diagram) => document.nodes[diagram.rootNodeId]?.label ?? diagram.id)
      .sort(),
    nodeLabels: Object.values(document.nodes).map((node) => node.label).sort(),
    nodeSignatures: Object.values(document.nodes).map(nodeSignature).sort(),
    wireSignatures: Object.values(document.wires)
      .map((wire) => `${wire.kind}|${wire.label}|${wire.source}>${wire.target}`)
      .sort(),
    linkSignatures: [],
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

/**
 * Censuses a migrated library.
 *
 * Produced in the same shape as the legacy census so the two can be compared field by field.
 * Where a fact legitimately changed home — a cross-diagram wire becoming a library link — it
 * appears under `linkSignatures`, so the comparison stays honest instead of quietly forgiving.
 */
export function censusOfMigratedLibrary(library: MigratedLibrary): CanvasCensus {
  const records = Object.values(library.records);

  return {
    diagramNames: records.map((record) => record.name).sort(),
    nodeLabels: records.flatMap((record) => Object.values(record.nodes).map((node) => node.label)).sort(),
    nodeSignatures: records.flatMap((record) => Object.values(record.nodes).map(nodeSignature)).sort(),
    wireSignatures: records
      .flatMap((record) => Object.values(record.wires))
      .map((wire) => `${wire.kind}|${wire.label}|${wire.source.nodeId}>${wire.target.nodeId}`)
      .sort(),
    linkSignatures: Object.values(library.index.links)
      .map((link) => `${link.kind}|${link.label}|${link.source.nodeId}>${link.target.nodeId}`)
      .sort(),
    interfaceSignatures: records
      .flatMap((record) => Object.values(record.interfaces))
      .map((object) => `${object.ownerId}.${object.id}:${object.name}`)
      .sort(),
    typeIds: records.flatMap((record) => Object.keys(record.types)).sort(),
    placements: Object.fromEntries(records.flatMap((record) => Object.values(record.layouts)
      .flatMap((layout) => Object.values(layout.placements).map((placement) => [
        placement.nodeId,
        geometry(placement.position.x, placement.position.y, placement.size.width, placement.size.height),
      ] as const)))),
    appliedOperationIds: Object.keys(library.index.migratedOperations).sort(),
  };
}
