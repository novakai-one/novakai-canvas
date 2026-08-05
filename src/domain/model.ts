/** Stable, serialisable vocabulary shared across every module. */

export type NodeKind = 'scope' | 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'tree';

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
}

/** App colour theme choices. */
export type CanvasTheme = 'dark' | 'light';
type CanvasAccent = 'gold' | 'sage' | 'slate';

/** User-controlled visual and interaction preferences. */
export interface CanvasPreferences {
  schemaVersion: 1;
  appearance: {
    density: 'compact' | 'comfortable';
    radius: number;
    theme: CanvasTheme;
    accent: CanvasAccent;
  };
  canvas: {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    showControls: boolean;
    showLegend: boolean;
    groupPadding: number;
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
  };
  panel: { width: number; defaultTab: InspectorTab; showEmptyFields: boolean };
  files: { autoSave: boolean; saveDelay: number };
}

/** Universal selection reference for inspectors. */
export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'interface'; id: string }
  | { kind: 'type'; id: string }
  | { kind: 'wire'; id: string }
  | { kind: 'tree-row'; nodeId: string; rowId: string }
  | null;

/** Complete set of supported domain intentions. */
export type CanvasCommand =
  | { kind: 'node.add'; node: CanvasNode; placement: NodePlacement }
  | { kind: 'node.move'; id: string; position: Position; layoutId?: string }
  | { kind: 'node.resize'; id: string; size: Size; layoutId?: string }
  | { kind: 'node.update'; id: string; patch: Partial<Pick<CanvasNode, 'label' | 'description' | 'kind'>> }
  | { kind: 'node.remove'; id: string }
  | { kind: 'wire.add'; wire: CanvasWire }
  | { kind: 'wire.update'; id: string; patch: Partial<Pick<CanvasWire, 'label' | 'kind'>> }
  | { kind: 'wire.reconnect'; id: string; source: string; target: string }
  | { kind: 'wire.remove'; id: string }
  | { kind: 'scope.layout'; id: string; layoutId?: string; groupPadding?: number };
