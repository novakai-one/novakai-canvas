/** Stable, serialisable vocabulary shared across every module. */

export type NodeKind = 'scope' | 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'tree' | 'timeline';

/** Relationship vocabulary carried by wires; renderers style each kind distinctly. */
export type WireKind =
  | 'owns' | 'references' | 'assigns' | 'queries' | 'executes'
  | 'mentions' | 'missing';

/** Available inspector surfaces. */
export type InspectorTab = 'inspect' | 'preferences' | 'json';

/** Compact preference categories. */
export type PreferenceSection = 'theme' | 'canvas' | 'nodes' | 'wires' | 'panel' | 'files';

export interface Position { x: number; y: number; }
export interface Size { width: number; height: number; }

/** Row kinds a tree node can carry. */
type TreeRowKind = 'project' | 'mission' | 'task' | 'bucket';

/** One semantic row inside a tree node — identity only; looks derive in presentation. */
export interface TreeRow {
  id: string;
  kind: TreeRowKind;
  status?: string;
  parentRowId?: string;
  badges: string[];
  /** Display override for aggregate rows (e.g. "(no mission) 15 tasks"). */
  label?: string;
}

/** One semantic turn inside a timeline node. */
export interface TimelineStep {
  id: string;
  label: string;
  fork?: string;
}

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
  /** Optional identity of the real thing this drawing occurrence represents. */
  subjectRef?: CanvasReference;
  /** Optional deeper explanation opened from this overview occurrence. */
  expandsToDiagramId?: string;
}

export interface CanvasReference {
  namespace: string;
  id: string;
}

export interface SourceReference extends CanvasReference {
  label?: string;
}

/** One selectable interface exposed by a node. */
export interface InterfaceObject {
  id: string;
  ownerId: string;
  name: string;
  accepts: string[];
  returns: string[];
}

/** One selectable shared type definition. */
export interface TypeObject {
  id: string;
  name: string;
  fields: string[];
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
export interface PositionedCanvasNode extends CanvasNode {
  position: Position;
  size: Size;
}

/** Canonical serialisable architecture map. */
export interface ArchitectureDocument {
  schemaVersion: 2;
  id: string;
  name: string;
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

/** App colour theme choices. */
export type CanvasTheme = 'dark' | 'light';
type CanvasAccent = 'gold' | 'sage' | 'slate';

/** User-controlled visual and interaction preferences. */
export interface CanvasPreferences {
  schemaVersion: 1;
  appearance: {
    density: 'compact' | 'comfortable' | 'roomy';
    radius: number;
    theme: CanvasTheme;
    accent: CanvasAccent;
    /**
     * Scales every type size together.
     *
     * A separate knob from density because "more air" and "bigger words" are different
     * complaints with different answers, and guessing which one is meant is exactly what
     * offering both avoids.
     */
    textScale?: number;
  };
  canvas: {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    showControls: boolean;
    showLegend: boolean;
    groupPadding: number;
    /** How large the things you grab on the canvas are: ports, handles, wire ends. */
    targetSize?: 'small' | 'medium' | 'large';
  };
  nodes: {
    showKinds: boolean;
    showDescriptions: boolean;
    showInterfaces: 'always' | 'selected' | 'never';
    showTypes: boolean;
    showPorts: 'always' | 'hover';
  };
  wires: {
    showLabels: 'always' | 'selected' | 'never';
    width: number;
    dimUnrelated: boolean;
    /**
     * How wires are drawn along the route the router chose.
     *
     * Shape only: every value draws the SAME points, so choosing curves can never make a wire
     * start cutting through a node. Optional, so a preferences file written before shapes
     * existed opens at the elbow this app has always drawn.
     */
    shape?: 'elbow' | 'straight' | 'curved' | 'stepped';
    /** Scales the wire-label type on its own, without touching the panels. */
    labelScale?: number;
    /** Largest label type in diagram pixels; labels disappear when zoom would exceed it. */
    maxLabelSize?: number;
    /** Whether the router detours around unrelated nodes. On is the standard. */
    avoidNodes?: boolean;
  };
  /**
   * Panel geometry. `width` is the Studio's; the rail's and the collapsed flags are optional so
   * a preferences file written before the rail existed still opens, at the shell's defaults.
   */
  panel: {
    width: number;
    defaultTab: InspectorTab;
    showEmptyFields: boolean;
    /** Section rules on or off; the spacing does the grouping either way. */
    showDividers?: boolean;
    /** Which left-panel surface opens with the app. */
    leftDefaultTab?: 'build' | 'contents';
    railWidth?: number;
    railCollapsed?: boolean;
    studioCollapsed?: boolean;
    /**
     * Whether opening or resizing a panel re-frames the diagram.
     *
     * Off by default, and off is the law: Chris — "I dont want things to automatically change my
     * view focus / zoom -> Put that setting in the right panel, maybe someone will like it."
     * Some people do like the canvas re-fitting itself into the space a panel just freed, so it
     * stays available; it is simply never the default, and never silent.
     */
    reframeOnPanelMove?: boolean;
    /**
     * How a panel body distributes its sections.
     *
     * `accordion` keeps one section open and its siblings one heading row each, which is what
     * bounds how much a panel can ever show at once. `all-open` is the old everything-at-once,
     * kept because some people want it — it is a preference, not an argument.
     */
    sections?: 'accordion' | 'all-open';
  };
  files: { autoSave: boolean; saveDelay: number };
}

/** Universal selection reference for inspectors. */
export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'interface'; id: string }
  | { kind: 'type'; id: string }
  | { kind: 'wire'; id: string }
  | { kind: 'tree-row'; nodeId: string; rowId: string }
  | { kind: 'timeline-step'; nodeId: string; stepId: string }
  | null;

/** Complete set of supported domain intentions. */
export type CanvasCommand =
  | { kind: 'diagram.create'; diagram: CanvasDiagram; root: CanvasNode; placement: NodePlacement }
  | { kind: 'diagram.setStatus'; id: string; status: CanvasDiagram['status'] }
  | { kind: 'diagram.setReferences'; id: string; subjectRef?: CanvasReference; sourceRefs: SourceReference[] }
  | { kind: 'node.add'; node: CanvasNode; placement: NodePlacement }
  | { kind: 'node.move'; id: string; position: Position; layoutId?: string }
  | { kind: 'node.resize'; id: string; size: Size; layoutId?: string }
  | { kind: 'node.pin'; id: string; pinned: boolean; layoutId?: string }
  | { kind: 'node.update'; id: string; patch: Partial<Pick<CanvasNode, 'label' | 'description' | 'kind'>> }
  | { kind: 'node.setSubject'; id: string; subjectRef?: CanvasReference }
  | { kind: 'node.setDetailDiagram'; id: string; diagramId?: string }
  | { kind: 'node.reparent'; id: string; parentId: string }
  | { kind: 'node.setCollapsed'; id: string; collapsed: boolean; layoutId?: string }
  | { kind: 'node.remove'; id: string }
  | { kind: 'wire.add'; wire: CanvasWire }
  | { kind: 'wire.update'; id: string; patch: Partial<Pick<CanvasWire, 'label' | 'kind'>> }
  | { kind: 'wire.reconnect'; id: string; source: string; target: string }
  | { kind: 'wire.remove'; id: string }
  | { kind: 'layout.apply'; proposal: LayoutProposal }
  | { kind: 'scope.layout'; id: string; layoutId?: string; groupPadding?: number };

export interface CanvasActor {
  id: string;
  kind: 'human' | 'agent' | 'system';
}

export interface CanvasProvenance {
  source: 'ui' | 'cli' | 'agent' | 'import' | 'system';
  sourceRef?: string;
}

/** One all-or-nothing public edit shared by human and agent hosts. */
export interface CanvasChangeSet {
  operationId: string;
  expectedRevision: number;
  actor: CanvasActor;
  timestamp: string;
  provenance: CanvasProvenance;
  commands: CanvasCommand[];
}

export interface AppliedCanvasOperation {
  operationId: string;
  revision: number;
  actor: CanvasActor;
  timestamp: string;
  provenance: CanvasProvenance;
  commandKinds: Array<CanvasCommand['kind'] | 'document.import'>;
}

export type CanvasChangeOutcome =
  | { status: 'applied'; operationId: string; revision: number; commandsApplied: number }
  | { status: 'duplicate'; operationId: string; originalRevision: number; revision: number }
  | { status: 'conflict'; operationId: string; expectedRevision: number; actualRevision: number }
  | { status: 'rejected'; operationId: string; reason: string; commandIndex?: number };

/** Whole-document import seam used by compilers while the capability remains revision authority. */
export interface CanvasImportSet {
  operationId: string;
  expectedRevision: number;
  actor: CanvasActor;
  timestamp: string;
  provenance: CanvasProvenance;
  document: ArchitectureDocument;
}

/** Machine-readable vocabulary so an unfamiliar host does not inspect UI source. */
export interface CanvasCapabilityDescription {
  schemaVersion: ArchitectureDocument['schemaVersion'];
  revision: number;
  nodeKinds: NodeKind[];
  nodeAliases: Record<string, NodeKind>;
  wireKinds: WireKind[];
  layoutTargets: Array<'diagram' | 'group' | 'nodes'>;
  layoutStrategies: CanvasLayout['strategy'][];
  commandKinds: Array<CanvasCommand['kind'] | 'document.import'>;
}
