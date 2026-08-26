/** Framework-free authoring operations shared by the CLI and contract suites. */
export { parseDsl } from '../core/authoring/dsl-parse.ts';
export { compile } from '../core/authoring/compile.ts';
export type {
  CompileError,
  CompiledDiagram,
  CompileResult,
  CrossDiagramWire,
  LinkEnd,
} from '../core/authoring/compile.ts';
export {
  applyCompiledDiagram,
  blankRecord,
  commandsFor,
  findNodeByLabel,
  recordForCompiled,
  removalCommandsFor,
} from '../core/authoring/records/record-apply.ts';
export {
  layoutInitialRecord,
  placementsOf,
  type RecordNode,
  type RecordPlacement,
  type RecordWire,
} from '../core/authoring/records/record-graph.ts';
export { reconcileLinks } from '../core/authoring/reconcile-links.ts';
export { estimateNodeSize } from '../core/authoring/layout.ts';
export { slugify } from '../core/authoring/slug.ts';
export { renderRecordSvg } from '../core/rendering/snapshot.ts';
export {
  CLI_HELP,
  COMMAND_KINDS,
  describeCapability,
} from '../core/authoring/cli-contract.ts';
export { listMaps, type MapSummary } from '../core/application/map-listing.ts';
export { rootGroupId } from '../core/export/ordering.ts';
