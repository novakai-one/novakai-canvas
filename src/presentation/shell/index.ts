/**
 * The studio shell — the public surface every panel in this application is built from.
 *
 * Nothing here knows what a diagram is. The primitives take strings, numbers, and children, so
 * the same shell dresses the rail, the Studio, and any future panel without a change in here.
 */
export { FieldRow, SwitchRow } from './field-row';
export { ObjectRow } from './object-row';
export { PanelBand, PanelFooter } from './panel-band';
export { RailAction, RailRow } from './rail-row';
export { IconButton, PanelHeader, type PanelHeaderProps } from './panel-header';
export { PanelBody, PanelSection } from './panel-section';
export { PanelShell, type PanelShellProps } from './panel-shell';
export { ShellControls } from './shell-controls';
export { ShellGeometryProvider, useShellGeometry, type ShellGeometry } from './shell-geometry';
export { TabStrip } from './tab-strip';
export {
  RAIL_BOUNDS, STUDIO_BOUNDS, clampPanelWidth, widthFromDrag, type PanelBounds,
} from './panel-width';
