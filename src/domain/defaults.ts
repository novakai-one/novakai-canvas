import type { CanvasPreferences } from './canvas-preferences.ts';
import type { ArchitectureDocument } from './legacy-document.ts';
import { WIRE_LABEL_SIZE_LIMITS } from './wire-label-size';

/** Safe empty document used when loading fails. */
export const emptyArchitecture: ArchitectureDocument = {
  schemaVersion: 2,
  id: 'new-map',
  name: 'Untitled architecture',
  revision: 0,
  nodes: {},
  interfaces: {},
  types: {},
  wires: {},
  activeLayoutId: 'layout-default',
  layouts: {
    'layout-default': {
      id: 'layout-default',
      name: 'Default',
      strategy: 'manual',
      placements: {},
      wireRouteHints: {},
      collapsedNodeIds: [],
    },
  },
  diagrams: {},
  appliedOperations: {},
};

/** Safe visual defaults used when loading fails. */
export const defaultPreferences: CanvasPreferences = {
  schemaVersion: 1,
  appearance: { density: 'comfortable', radius: 6, theme: 'dark', accent: 'gold', textScale: 1 },
  canvas: {
    showGrid: false,
    snapToGrid: true,
    gridSize: 8,
    showControls: true,
    showLegend: true,
    groupPadding: 40,
    targetSize: 'medium',
  },
  nodes: {
    showKinds: true,
    showDescriptions: false,
    showInterfaces: 'always',
    showTypes: true,
    showPorts: 'hover',
  },
  wires: {
    showLabels: 'always',
    width: 1.25,
    dimUnrelated: true,
    shape: 'elbow',
    labelScale: 1,
    maxLabelSize: WIRE_LABEL_SIZE_LIMITS.defaultMaximum,
    avoidNodes: true,
  },
  panel: {
    width: 380,
    defaultTab: 'inspect',
    showEmptyFields: false,
    sections: 'accordion',
    showDividers: true,
    leftDefaultTab: 'build',
    /*
     * Off, and off is the law. Chris, twice: the camera must never move except by his own
     * zoom, pan, fit, or an explicit travel. It stays available because some people like the
     * canvas re-fitting into the space a panel just freed; it is simply never the default.
     */
    reframeOnPanelMove: false,
  },
  files: { autoSave: true, saveDelay: 500 },
};
