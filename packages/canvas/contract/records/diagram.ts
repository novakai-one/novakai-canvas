import type {
  DiagramId, FlowId, InterfaceId, NodeId, TypeId, ViewId, WireId,
} from '../brands.ts';
import type {
  CalloutItem, EntityField, IconCardIcon, IconGridItem, MetricStatus, OouxRow, TimelineStep,
  TreeRow,
} from './components.ts';
import type {
  CanvasReference, InterfaceObject, SourceReference, TypeObject,
} from './architecture.ts';
import type { CanvasLayout, CanvasViewBase, PortSide } from './layout.ts';
import type { Orientation } from '../types/orientation.ts';
import type { NodeKind } from '../types/node-kind.ts';
import type { WireCardinality } from '../schemas/wire-cardinality.ts';

export type {
  CanvasLayout, LayoutStrategyName, NodePlacement, PortSide, WireRouteHint,
} from './layout.ts';
export type { NodeKind } from '../types/node-kind.ts';

/** Relationship vocabulary carried by wires; renderers style each kind distinctly. */
export type WireKind =
  | 'owns' | 'references' | 'assigns' | 'queries' | 'executes' | 'mentions' | 'missing';

/** A stable attachment point on a node's edge. */
export interface PortAnchor { side: PortSide; ordinal: number }

/** One end of a wire. Absent anchor means the renderer picks the side. */
export interface Endpoint { nodeId: NodeId; anchor?: PortAnchor; cardinality?: WireCardinality }

/** One semantic, selectable object. Geometry lives in a layout, never here. */
export interface CanvasNode {
  id: NodeId;
  kind: NodeKind;
  label: string;
  description?: string;
  parentId?: NodeId;
  band?: number;
  lane?: number;
  crossing?: 'gated' | 'free';
  gate?: NodeId;
  interfaceIds: InterfaceId[];
  typeIds: TypeId[];
  rows?: TreeRow[];
  steps?: TimelineStep[];
  value?: string;
  detail?: string;
  status?: MetricStatus;
  icon?: IconCardIcon;
  iconItems?: IconGridItem[];
  callouts?: CalloutItem[];
  lines?: string[];
  wireRef?: string;
  objectRef?: string;
  oouxRows?: OouxRow[];
  entityRef?: string;
  entityFields?: EntityField[];
  subjectRef?: CanvasReference;
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

/** One ordered reference to a wire already owned by this diagram. */
export interface FlowStep {
  ref: WireId;
  ordinal: number;
  /**
   * What this step does, shown on the wire's step badge and in the flow
   * panel (e.g. "save()"). Absent, the badge shows the ordinal alone.
   * Steps may reuse one wire with different labels.
   */
  label?: string;
}

/** A named semantic path over existing wires; it owns no graph or geometry. */
export interface Flow { id: FlowId; name: string; steps: FlowStep[] }

/** Reading state for one saved view. */
export interface CanvasView extends CanvasViewBase { hiddenKinds: NodeKind[] }

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
  name: string;
  orientation?: Orientation;
  status: 'active' | 'archived';
  revision: number;
  nodes: Record<string, CanvasNode>;
  wires: Record<string, CanvasWire>;
  flows?: Record<string, Flow>;
  interfaces: Record<string, InterfaceObject>;
  types: Record<string, TypeObject>;
  layouts: Record<string, CanvasLayout>;
  views: Record<string, CanvasView>;
  activeViewId: ViewId;
  subjectRef?: CanvasReference;
  sourceRefs: SourceReference[];
  appliedOperations: Record<string, AppliedCanvasOperation>;
}
