/** V2 document contracts retained for migration and compatibility hosts. */

import type { Orientation } from './axis.ts';
import type { ContainerArrangement, NodeAppearance } from './canvas-presentation.ts';
import type {
  CanvasReference, InterfaceObject, SourceReference, TypeObject,
} from './architecture-values.ts';
import type {
  CalloutItem, IconCardIcon, MetricStatus, TimelineStep, TreeRow,
} from './component-content.ts';
import type { AppliedCanvasOperation } from './legacy-operation.ts';
import type { Position, Size } from './spatial.ts';
import type { WireAppearance } from './wire-appearance.ts';
import type { OouxRow } from './ooux-object.ts';

export type NodeKind = 'scope' | 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'tree' | 'timeline' | 'metric' | 'icon-card' | 'block' | 'ooux-object';

/** Relationship vocabulary carried by wires; renderers style each kind distinctly. */
export type WireKind =
  | 'owns' | 'references' | 'assigns' | 'queries' | 'executes'
  | 'mentions' | 'missing';

/** One semantic, selectable architecture object. Geometry belongs to a layout. */
export interface CanvasNode {
  id: string;
  kind: NodeKind;
  label: string;
  description?: string;
  parentId?: string;
  interfaceIds: string[];
  typeIds: string[];
  /** Semantic hierarchy rows; present only on kind "tree". */
  rows?: TreeRow[];
  /** Ordered semantic turns; present only on kind "timeline". */
  steps?: TimelineStep[];
  /** Required value and optional context; present only on kind "metric". */
  value?: string;
  detail?: string;
  status?: MetricStatus;
  /** Fixed semantic symbol; present only on kind "icon-card". */
  icon?: IconCardIcon;
  /** Ordered highlights; present only on kind "callout-stack". */
  callouts?: CalloutItem[];
  /** Ordered semantic text; present only on kind "block". */
  lines?: string[];
  /** Stable agent-facing address for a block. */
  wireRef?: string;
  objectRef?: string;
  oouxRows?: OouxRow[];
  /** Optional identity of the real thing this drawing occurrence represents. */
  subjectRef?: CanvasReference;
  /** Optional deeper explanation opened from this overview occurrence. */
  expandsToDiagramId?: string;
}

export interface CanvasWire {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: WireKind;
  routing: 'elbow';
}

/** One node's geometry inside one saved layout. */
export interface NodePlacement {
  nodeId: string;
  position: Position;
  size: Size;
  sizeMode?: 'auto' | 'manual';
  pinned: boolean;
}

/** Small durable routing preference; the renderer still owns the concrete path. */
export interface WireRouteHint {
  wireId: string;
  preferredSourceSide?: 'top' | 'right' | 'bottom' | 'left';
  preferredTargetSide?: 'top' | 'right' | 'bottom' | 'left';
  waypoints: Position[];
}

/** One named arrangement of a semantic architecture document. */
export interface CanvasLayout {
  id: string;
  name: string;
  strategy: 'manual' | 'hierarchy';
  placements: Record<string, NodePlacement>;
  wireRouteHints: Record<string, WireRouteHint>;
  collapsedNodeIds: string[];
  appearanceByNodeId?: Record<string, NodeAppearance>;
  appearanceByWireId?: Record<string, WireAppearance>;
  arrangementByContainerId?: Record<string, ContainerArrangement>;
}

/** Library identity and lifecycle; diagram title remains owned by its root scope node. */
export interface CanvasDiagram {
  id: string;
  rootNodeId: string;
  status: 'active' | 'archived';
  subjectRef?: CanvasReference;
  sourceRefs: SourceReference[];
}

export type LayoutTarget =
  | { kind: 'scope'; scopeId: string }
  | { kind: 'nodes'; nodeIds: string[] };

export interface LayoutRequest {
  target: LayoutTarget;
  layoutId?: string;
  groupPadding?: number;
}

/** Transient, revision-bound geometry proposal; saving it requires an explicit command. */
export interface LayoutProposal {
  baseRevision: number;
  layoutId: string;
  target: LayoutTarget;
  affectedNodeIds: string[];
  placements: Record<string, NodePlacement>;
}

/** Semantic node joined with geometry for layout and rendering adapters. */
export interface PositionedCanvasNode extends CanvasNode { position: Position; size: Size }

/** Canonical serialisable architecture map. */
export interface ArchitectureDocument {
  schemaVersion: 2;
  id: string;
  name: string;
  /** Copied from the record; the geometry engine resolves its axis from this. */
  orientation?: Orientation;
  revision: number;
  nodes: Record<string, CanvasNode>;
  interfaces: Record<string, InterfaceObject>;
  types: Record<string, TypeObject>;
  wires: Record<string, CanvasWire>;
  activeLayoutId: string;
  layouts: Record<string, CanvasLayout>;
  diagrams: Record<string, CanvasDiagram>;
  /** Durable idempotency and authorship trace for atomic public operations. */
  appliedOperations: Record<string, AppliedCanvasOperation>;
}
