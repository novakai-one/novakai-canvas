/**
 * Existing host compatibility surface.
 *
 * These declarations were previously reached through private source paths. They remain public
 * while Canvas is reorganised so the host changes imports without changing behaviour.
 */
export { asId } from '../core/domain/id-cast.ts';
export type { InterfaceId } from './brands.ts';
export type {
  CanvasPreferences,
  CanvasTheme,
  PreferenceSection,
  ResolvedCanvasTheme,
  ThemeColorRole,
  ThemeOverrides,
  ThemeOverridesByPreset,
  ThemePalette,
  ThemePresetId,
} from './records/preferences.ts';
export { THEME_COLOR_ROLES, THEME_PRESET_IDS } from './records/preferences.ts';
export type { Selection } from './types/selection.ts';
export type { InterfaceObject, TypeObject } from './records/architecture.ts';
export type { NodeKind } from './types/node-kind.ts';
export type {
  CanvasNode as DiagramNode,
  CanvasWire as DiagramWire,
  CanvasView,
  CanvasLayout as DiagramLayout,
  NodePlacement as DiagramNodePlacement,
  WireRouteHint as DiagramWireRouteHint,
  PortSide,
  WireKind,
} from './records/index.ts';
export {
  NODE_PORTS,
} from '../core/domain/node-port.ts';
export {
  interfaceRowCenter,
} from '../core/components/card/measure.ts';
export {
  portAnchorFromHandle,
  portAxisFraction,
  portHandleId,
} from '../core/domain/interface-signature.ts';
export {
  allComponents,
  componentFor,
  contentFieldsFor,
} from '../core/components/registry.ts';
export type {
  ContentEditorDeclaration,
  DiagramComponent,
  RecordEditorField,
  RecordEditorVariant,
  RecordListContentEditorDeclaration,
  StringListContentEditorDeclaration,
} from '../core/components/component.ts';
export { GLYPHS } from '../core/components/glyphs.ts';
export { inscribedContentBox, outlinePath } from '../core/components/outline.ts';
export { layoutBlockText } from '../core/components/block/text-layout.ts';
export {
  paletteCssVariables,
  resolveComponentPalette,
} from '../core/components/component-palette.ts';
export {
  orderedTreeRows,
  treeRowDepth,
} from '../core/components/tree/content.ts';
export type { TreeRow } from './records/components.ts';
export {
  appearanceSpecifications,
  CONTAINER_ALIGNS,
  GRID_COLUMNS,
  SPACINGS,
} from './schemas/presentation.ts';
export type {
  AppearanceSpecification,
  AuthoredArrangement,
  GridColumns,
  Spacing,
} from './schemas/presentation.ts';
export {
  WIRE_APPEARANCE_SPECIFICATIONS,
  WIRE_SHAPES,
} from './schemas/wire-appearance.ts';
export type { WireAppearance } from './schemas/wire-appearance.ts';
export {
  WIRE_CARDINALITIES,
  WIRE_CARDINALITY_LABELS,
} from './schemas/wire-cardinality.ts';
export type { WireCardinality } from './schemas/wire-cardinality.ts';
export { WIRE_LABEL_SIZE_LIMITS } from './schemas/preferences.ts';
export { defaultPreferences, emptyArchitecture } from '../core/domain/defaults.ts';
export { THEME_PRESETS } from '../core/domain/theme-palettes.ts';
export {
  mixThemeColors,
  resolveCanvasTheme,
  themeContrastRatio,
  themeTokenColor,
  withThemeAlpha,
} from '../core/domain/theme-resolver.ts';
export { canvasPreferencesSchema } from './schemas/preferences.ts';
export { createHttpJsonRepository } from '../adapters/http-json-repository.ts';
export { isSignatureName } from '../core/application/canvas-workspace.ts';
export { validateRecordCommand } from '../core/application/canvas-workspace/command-validation.ts';
export {
  chooseSides,
  editableRouteSegments,
  facingSides,
  nearestPositionAlong,
  nodeRects,
  pointAlong,
  polylineLength,
  reshapeRouteSegment,
  routeCollisions,
  routePath,
  segmentIntersectsRect,
  wireObstacles,
} from '../core/domain/diagram-geometry.ts';
export type {
  Point,
  Rect,
  WireRouteEditResult,
} from '../core/domain/diagram-geometry.ts';
export { wireLabelSpread } from '../core/domain/wire-label-seed.ts';
export {
  resolveTreeToneColors,
  resolveWireToneColors,
  resolveWireAppearance,
  wireLabelSizing,
  wireStrokeWidth,
} from '../core/rendering/wire-styles.ts';
export type { ResolvedWireAppearance } from '../core/rendering/wire-styles.ts';
export {
  WIRE_SHAPE_HINTS,
  asWireShape,
  wirePath,
} from '../core/rendering/wire-shape.ts';
export { planWireEndDecorations } from '../core/rendering/wire-end-decorations.ts';
