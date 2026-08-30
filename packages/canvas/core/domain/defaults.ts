import type { CanvasPreferences } from '../../contract/records/preferences.ts';
import type { ArchitectureDocument } from '../../contract/records/legacy-document.ts';
import { WIRE_LABEL_SIZE_LIMITS } from '../../contract/schemas/preferences.ts';

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
  schemaVersion: 2,
  appearance: {
    density: 'comfortable', radius: 6, preset: 'carbon', overridesByPreset: {}, textScale: 1,
  },
  canvas: {
    showGrid: false,
    snapToGrid: true,
    gridSize: 8,
    showControls: true,
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
    showLabels: 'selected',
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
    reframeOnPanelMove: false,
  },
  files: { autoSave: true, saveDelay: 500 },
};
