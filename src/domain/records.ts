import type {
  DiagramId, InterfaceId, LinkId, NodeId, TypeId, ViewId, WireId,
} from './ids.ts';
import type {
  CalloutItem, IconCardIcon, MetricStatus, TimelineStep, TreeRow,
} from './component-content.ts';
import type {
  CanvasReference, InterfaceObject, SourceReference, TypeObject,
} from './architecture-values.ts';
import type { CanvasLayout, CanvasViewBase, PortSide } from './layout-record.ts';
import type { NodeKind } from './node-kind.ts';
import type { OouxRow } from './ooux-object.ts';
import type { EntityField } from './entity.ts';
import type { WireCardinality } from './wire-cardinality.ts';

export type {
  CanvasLayout, LayoutStrategyName, NodePlacement, PortSide, WireRouteHint,
} from './layout-record.ts';
export type { NodeKind } from './node-kind.ts';

/**
 * The v3 record model.
 *
 * One diagram is one independently stored, independently revisioned record. That boundary is
 * the whole point: an agent editing one map cannot conflict with a human editing another, and
 * reading one map never requires another to be readable.
 */

/**
 * What a node is.
 *
 * `group` replaces the old `scope` kind, which meant both "a whole map" and "a cluster inside
 * one" — one word for two concepts is why diagram titles used to live on a node. `tree` is kept
 * despite zero current instances: it has a domain module, a renderer, and DSL support.
 */
/** Relationship vocabulary carried by wires; renderers style each kind distinctly. */
export type WireKind =
  | 'owns' | 'references' | 'assigns' | 'queries' | 'executes' | 'mentions' | 'missing';

/**
 * A stable attachment point on a node's edge.
 *
 * Deliberately an ordinal rather than a name. An earlier design attached wires to interfaces,
 * but interface IDs are minted from slugified labels and regenerated wholesale on every
 * `./canvas apply` — so a port keyed on one would silently detach whenever a method was
 * renamed, and would be a name-as-join besides.
 */
export interface PortAnchor { side: PortSide; ordinal: number }

/** One end of a wire. Absent anchor means "attach to the node, renderer picks the side". */
export interface Endpoint { nodeId: NodeId; anchor?: PortAnchor; cardinality?: WireCardinality }

/** One semantic, selectable object. Geometry lives in a layout, never here. */
export interface CanvasNode {
  id: NodeId;
  kind: NodeKind;
  label: string;
  description?: string;
  /** Resolves to a `group` node in the same diagram; the parent chain is acyclic. */
  parentId?: NodeId;
  interfaceIds: InterfaceId[];
  typeIds: TypeId[];
  /** Semantic hierarchy rows; present only on kind `tree`. */
  rows?: TreeRow[];
  /** Ordered steps; present only on kind `timeline`. */
  steps?: TimelineStep[];
  /** Required value and optional context; present only on kind `metric`. */
  value?: string;
  detail?: string;
  status?: MetricStatus;
  /** Fixed semantic symbol; present only on kind `icon-card`. */
  icon?: IconCardIcon;
  /** Ordered highlights; present only on kind `callout-stack`. */
  callouts?: CalloutItem[];
  /** Ordered semantic text; present only on kind `block`. */
  lines?: string[];
  /** Stable agent-facing address for a block; never used as the stored wire join. */
  wireRef?: string;
  /** Stable CLI identity and ordered compartments; present only on `ooux-object`. */
  objectRef?: string;
  oouxRows?: OouxRow[];
  /** Stable CLI identity and ordered fixed-column fields; present only on `entity`. */
  entityRef?: string;
  entityFields?: EntityField[];
  /** The real thing this occurrence depicts. Canvas references it and never owns it. */
  subjectRef?: CanvasReference;
  /** Deeper explanation opened from this occurrence; integrity is owned by the library. */
  expandsToDiagramId?: DiagramId;
}

/** One relationship between two occurrences in the same diagram. */
export interface CanvasWire {
  id: WireId;
  kind: WireKind;
  label: string;
  source: Endpoint;
  target: Endpoint;
}

/**
 * One saved reading view.
 *
 * Collapsed groups live here and nowhere else — holding them on both a layout and a view would
 * be two writers for one fact. Edit and Present are host chrome: neither appears in this model,
 * so the two modes cannot disagree about an arrangement.
 */
export interface CanvasView extends CanvasViewBase {
  hiddenKinds: NodeKind[];
}

/** Durable authorship and idempotency trace for one applied batch. */
export interface AppliedCanvasOperation {
  operationId: string;
  revision: number;
  actor: { id: string; kind: 'human' | 'agent' | 'system' };
  timestamp: string;
  provenance: { source: 'ui' | 'cli' | 'agent' | 'import' | 'system'; sourceRef?: string };
  commandKinds: string[];
}

/** One independently stored, independently revisioned diagram. */
export interface DiagramRecord {
  schemaVersion: 3;
  id: DiagramId;
  /** The diagram owns its own title; no node carries it. */
  name: string;
  status: 'active' | 'archived';
  revision: number;
  nodes: Record<string, CanvasNode>;
  wires: Record<string, CanvasWire>;
  interfaces: Record<string, InterfaceObject>;
  types: Record<string, TypeObject>;
  layouts: Record<string, CanvasLayout>;
  views: Record<string, CanvasView>;
  activeViewId: ViewId;
  subjectRef?: CanvasReference;
  sourceRefs: SourceReference[];
  appliedOperations: Record<string, AppliedCanvasOperation>;
}

/**
 * A relationship whose ends live in different diagrams.
 *
 * A wire belongs to exactly one diagram, so a relationship crossing two has no home there. The
 * library owns it instead — the alternative was dropping real relationships during migration.
 */
export interface CrossDiagramLink {
  id: LinkId;
  kind: WireKind;
  label: string;
  source: { diagramId: DiagramId; nodeId: NodeId; cardinality?: WireCardinality };
  target: { diagramId: DiagramId; nodeId: NodeId; cardinality?: WireCardinality };
}

/** One library entry: enough to list and search without opening the record. */
export interface LibraryEntry {
  id: DiagramId;
  name: string;
  status: 'active' | 'archived';
  revision: number;
  /** Denormalised for search. The diagram record remains the authority; this is a projection. */
  nodeLabels: string[];
}

/**
 * The searchable index over every diagram record, plus the facts that belong to no record.
 *
 * `entries` is a declared projection: every field in it is recomputable from the records, so a
 * write torn between a record and this index is repaired by rebuilding rather than reconciled.
 * `links` and `migratedOperations` are authoritative — they exist nowhere else.
 */
export interface LibraryIndex {
  schemaVersion: 3;
  /** Guards against two hosts last-writer-wins-ing the index while saving different diagrams. */
  revision: number;
  entries: Record<string, LibraryEntry>;
  links: Record<string, CrossDiagramLink>;
  /**
   * Operations applied before diagrams were split apart, kept whole.
   *
   * Idempotency was document-global; without carrying these forward, replaying a pre-migration
   * operation would apply it a second time. The full record is kept, not just the ID, because
   * a duplicate outcome has to report the revision the original produced.
   */
  migratedOperations: Record<string, AppliedCanvasOperation>;
}

/** Everything a migration produced, so nothing it decided is invisible. */
export interface MigrationReport {
  /** The version of the file as it was found on disk, before any chained upgrade step. */
  fromSchemaVersion: 1 | 2;
  diagramsCreated: number;
  /** Types referenced from more than one record, which would otherwise be copied into each. */
  sharedTypeIds: TypeId[];
  /** Nodes that belonged to no diagram and were placed in the Unfiled diagram. */
  unfiledNodeIds: NodeId[];
  /** Relationships converted from wires into library links. */
  crossDiagramLinkIds: LinkId[];
  carriedOperationIds: string[];
  /** Every record starts here, so any revision expected before migration reads as stale. */
  startingRevision: number;
}

/** A migrated library: the index, its records, and the report explaining what happened. */
export interface MigratedLibrary {
  index: LibraryIndex;
  records: Record<string, DiagramRecord>;
  report: MigrationReport;
}
