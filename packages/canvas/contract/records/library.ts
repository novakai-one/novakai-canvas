import type { DiagramId, LinkId, NodeId, TypeId } from '../brands.ts';
import type {
  AppliedCanvasOperation, DiagramRecord, WireKind,
} from './diagram.ts';
import type { WireCardinality } from '../schemas/wire-cardinality.ts';

/** A relationship whose ends live in different diagrams. */
export interface CrossDiagramLink {
  id: LinkId;
  kind: WireKind;
  label: string;
  source: { diagramId: DiagramId; nodeId: NodeId; cardinality?: WireCardinality };
  target: { diagramId: DiagramId; nodeId: NodeId; cardinality?: WireCardinality };
}

/** Enough metadata to list and search a diagram without opening its record. */
export interface LibraryEntry {
  id: DiagramId;
  name: string;
  status: 'active' | 'archived';
  revision: number;
  nodeLabels: string[];
}

/** Searchable index plus facts that belong to no individual diagram. */
export interface LibraryIndex {
  schemaVersion: 3;
  revision: number;
  entries: Record<string, LibraryEntry>;
  links: Record<string, CrossDiagramLink>;
  migratedOperations: Record<string, AppliedCanvasOperation>;
}

/** Everything a migration produced, including its decisions. */
export interface MigrationReport {
  fromSchemaVersion: 1 | 2;
  diagramsCreated: number;
  sharedTypeIds: TypeId[];
  unfiledNodeIds: NodeId[];
  crossDiagramLinkIds: LinkId[];
  carriedOperationIds: string[];
  startingRevision: number;
}

/** A migrated library: the index, records, and explanatory report. */
export interface MigratedLibrary {
  index: LibraryIndex;
  records: Record<string, DiagramRecord>;
  report: MigrationReport;
}
