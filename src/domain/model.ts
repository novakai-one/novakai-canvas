/** Stable, serialisable vocabulary shared across every module. */

type NodeKind = 'scope' | 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'tree';

/** Relationship vocabulary carried by wires; renderers style each kind distinctly. */
export type WireKind =
  | 'owns' | 'references' | 'assigns' | 'queries' | 'executes'
  | 'mentions' | 'missing';

/** Available inspector surfaces. */
export type InspectorTab = 'inspect' | 'preferences' | 'json';

/** Compact preference categories. */
export type PreferenceSection = 'theme' | 'canvas' | 'nodes' | 'wires' | 'panel' | 'files';

interface Position { x: number; y: number; }
interface Size { width: number; height: number; }

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

/** One positioned, selectable architecture object. */
export interface CanvasNode {
  id: string;
  kind: NodeKind;
  label: string;
  description?: string;
  position: Position;
  size: Size;
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

interface CanvasWire {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: WireKind;
  routing: 'elbow';
}

/** Canonical serialisable architecture map. */
export interface ArchitectureDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  revision: number;
  nodes: Record<string, CanvasNode>;
  interfaces: Record<string, InterfaceObject>;
  types: Record<string, TypeObject>;
  wires: Record<string, CanvasWire>;
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
  | { kind: 'node.add'; node: CanvasNode }
  | { kind: 'node.move'; id: string; position: Position }
  | { kind: 'node.resize'; id: string; size: Size }
  | { kind: 'node.update'; id: string; patch: Partial<Pick<CanvasNode, 'label' | 'description' | 'kind'>> }
  | { kind: 'node.remove'; id: string }
  | { kind: 'wire.add'; wire: CanvasWire }
  | { kind: 'wire.update'; id: string; patch: Partial<Pick<CanvasWire, 'label' | 'kind'>> }
  | { kind: 'wire.remove'; id: string }
  | { kind: 'scope.layout'; id: string };
