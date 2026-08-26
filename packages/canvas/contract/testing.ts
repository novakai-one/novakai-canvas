/** Existing framework-free operations exercised by the preserved contract suites. */
export { applyCanvasCommand } from '../core/domain/commands.ts';
export { placementFor } from '../core/domain/layouts.ts';
export {
  focusArchitecture,
  presentArchitecture,
  resolveArchitectureMap,
} from '../core/domain/maps.ts';
export { slugify } from '../core/authoring/slug.ts';
export { parseDsl } from '../core/authoring/dsl-parse.ts';
export { compile } from '../core/authoring/compile.ts';
export { listMaps } from '../core/application/map-listing.ts';
export { estimateNodeSize } from '../core/authoring/layout.ts';
export {
  layoutInitialRecord,
  placementsOf,
  type RecordNode,
  type RecordPlacement,
  type RecordWire,
} from '../core/authoring/records/record-graph.ts';
export { blankRecord } from '../core/authoring/records/record-target.ts';
export { renderRecordSvg } from '../core/rendering/snapshot.ts';
