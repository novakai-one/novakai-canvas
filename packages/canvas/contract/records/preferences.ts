import type { WireShape } from '../schemas/wire-appearance.ts';

/** Available inspector surfaces. */
export type InspectorTab = 'inspect' | 'preferences' | 'json';

/** Compact preference categories. */
export type PreferenceSection = 'theme' | 'canvas' | 'nodes' | 'wires' | 'panel' | 'files';

/** Curated theme presets. User overrides are stored independently for each preset. */
export const THEME_PRESET_IDS = [
  'carbon', 'midnight', 'plum', 'frost', 'porcelain', 'blueprint',
] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

/** The small colour vocabulary exposed in Settings. */
export const THEME_COLOR_ROLES = [
  'canvas', 'panel', 'surface', 'raised', 'border', 'text', 'muted', 'accent',
] as const;
export type ThemeColorRole = (typeof THEME_COLOR_ROLES)[number];
export type CanvasTheme = 'dark' | 'light';
export type ThemeOverrides = Partial<Record<ThemeColorRole, string>>;
export type ThemeOverridesByPreset = Partial<Record<ThemePresetId, ThemeOverrides>>;

/** Concrete base colours resolved from one preset and its optional overrides. */
export type ThemePalette = Record<ThemeColorRole, string>;

/** Semantic colours remain system-owned so status meaning cannot be remapped accidentally. */
export interface ThemeSemanticPalette {
  blue: string;
  violet: string;
  sage: string;
  rose: string;
  amber: string;
  danger: string;
}

/** Complete theme consumed by browser and SVG renderers. */
export interface ResolvedCanvasTheme {
  preset: ThemePresetId;
  label: string;
  mode: CanvasTheme;
  colors: ThemePalette;
  semantic: ThemeSemanticPalette;
}

/** User-controlled visual and interaction preferences. */
export interface CanvasPreferences {
  schemaVersion: 2;
  appearance: {
    density: 'compact' | 'comfortable' | 'roomy';
    radius: number;
    preset: ThemePresetId;
    overridesByPreset: ThemeOverridesByPreset;
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
