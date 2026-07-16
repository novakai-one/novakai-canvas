import type { ArchitectureDocument, CanvasPreferences } from './model';

export const emptyArchitecture: ArchitectureDocument = {
  schemaVersion: 1,
  id: 'new-map',
  name: 'Untitled architecture',
  revision: 0,
  nodes: {},
  interfaces: {},
  types: {},
  wires: {},
};

export const defaultPreferences: CanvasPreferences = {
  schemaVersion: 1,
  appearance: { density: 'comfortable', radius: 6 },
  canvas: { showGrid: false, snapToGrid: true, gridSize: 8, showControls: true },
  nodes: {
    showKinds: true,
    showDescriptions: false,
    showInterfaces: 'always',
    showTypes: true,
    showPorts: 'hover',
  },
  wires: { showLabels: 'selected', width: 1.25, dimUnrelated: true },
  panel: { width: 380, defaultTab: 'inspect', showEmptyFields: false },
  files: { autoSave: true, saveDelay: 500 },
};
