import type { WireShape } from '../schemas/wire-appearance.ts';

/** Available inspector surfaces. */
export type InspectorTab = 'inspect' | 'preferences' | 'json';

/** Compact preference categories. */
export type PreferenceSection = 'theme' | 'canvas' | 'nodes' | 'wires' | 'panel' | 'files';

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
    /** Scales every type size together, independently of density. */
    textScale?: number;
  };
  canvas: {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    showControls: boolean;
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
    /** Optional for compatibility; omitted uses the host's elbow default. */
    shape?: WireShape;
    /** Scales the wire-label type without changing panel text. */
    labelScale?: number;
    /** Largest label type in diagram pixels before zoom hides it. */
    maxLabelSize?: number;
    /** Whether the router detours around unrelated nodes. */
    avoidNodes?: boolean;
  };
  /** Persisted panel geometry and presentation choices. */
  panel: {
    width: number;
    defaultTab: InspectorTab;
    showEmptyFields: boolean;
    showDividers?: boolean;
    leftDefaultTab?: 'build' | 'contents';
    railWidth?: number;
    railCollapsed?: boolean;
    studioCollapsed?: boolean;
    /** Whether panel movement may re-frame the diagram; off remains the default. */
    reframeOnPanelMove?: boolean;
    /** One open section or the legacy all-open presentation. */
    sections?: 'accordion' | 'all-open';
  };
  files: { autoSave: boolean; saveDelay: number };
}
