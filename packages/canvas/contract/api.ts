/** Framework-free public surface shared by the web host, CLI, agents, and future Novakai host. */

// The record capability: independent per-diagram records with one library over them. Hosts
// reach Canvas through this file and never through a path below it.
export { createCanvasLibrary } from '../core/application/canvas-library.ts';
export type { CanvasLibrary, DiagramSummary } from './library.ts';
export type { LibraryFailure } from './errors.ts';
export type { CanvasLibraryRepository, WriteOutcome } from './ports/library-repository.ts';
export { createDiagramExportService } from '../core/application/diagram-export-service.ts';
export { exportDiagram, exportDiagrams } from '../core/export/export-diagrams.ts';
export { DIAGRAM_EXPORT_FORMATS } from '../core/export/contract.ts';
export type {
  DiagramExportContext, DiagramExportFormat, DiagramExportService,
} from '../core/export/contract.ts';
export { createCanvasWorkspace } from '../core/application/canvas-workspace.ts';
export type {
  ActorContext, CanvasWorkspace, ChangeOutcome, RecordChangeSet, RecordCommand,
} from './workspace.ts';
export { diagramRecordSchema, libraryIndexSchema } from '../core/domain/record-schema.ts';
export { migrateDocumentToLibrary } from '../core/domain/migrate/v2-to-v3.ts';
export { censusOfLegacyDocument, censusOfMigratedLibrary } from '../core/domain/migrate/census.ts';
export type { CanvasCensus } from '../core/domain/migrate/census.ts';
export type {
  CrossDiagramLink, DiagramRecord, Flow, FlowStep, LibraryEntry, LibraryIndex, MigratedLibrary, MigrationReport,
} from './records/index.ts';
export { resolveNodeAppearance } from '../core/domain/node-appearance.ts';
export type {
  AppearanceKey, ContainerArrangement, NodeAppearance, PresentationContext, ResolvedNodeAppearance,
} from './schemas/presentation.ts';
export type {
  DiagramId, FlowId, LayoutId, LinkId, NodeId, TypeId, ViewId, WireId,
} from './brands.ts';
export {
  compileFlows, emphasisLevel, FlowError, stepsByWire, stepsOf, wireEmphasis,
  type CompiledFlow, type Emphasis, type FlowLibrary,
} from '../core/domain/flows.ts';
export { projectView } from '../core/domain/project-view.ts';
export type { PositionedNode, ProjectedView } from '../core/domain/project-view.ts';
export {
  layoutScopes, planWireRoutes, reflowPresentation, reflowTopology, routeWire,
} from '../core/domain/diagram-geometry.ts';
export type {
  PlannedWireRoute, Point as GeometryPoint, Rect as GeometryRect, RouteObstacle, RouteSide,
  WireRoute, WireRouteRequest,
} from '../core/domain/diagram-geometry.ts';
export {
  crossAxis, orientationOf, resolveAxis, type Axis,
} from '../core/domain/axis.ts';
export { isOrientation, ORIENTATIONS, type Orientation } from './types/orientation.ts';
export { defaultLayoutOptions } from '../core/domain/layout/contract.ts';
export type {
  LayoutGraph, LayoutOptions, LayoutPlan, LayoutSliceTarget, LayoutStrategy,
} from '../core/domain/layout/contract.ts';
export { graphOfDiagram } from '../core/domain/layout/graph.ts';
export { layoutStrategyFor, planSliceLayout } from '../core/domain/layout/plan.ts';
export {
  compileTopology, crossingsOf, EMPTY_TOPOLOGY, gateOf, isEmptyTopology, isInside,
  TopologyError, type Boundary, type Crossing, type CrossingPolicy, type Topology,
} from '../core/domain/topology.ts';
export { laneRuler, LANE_GAP, type LaneRuler } from '../core/domain/lane-ruler.ts';

export { createCanvasEngine, type CanvasEngine } from '../core/application/canvas-engine.ts';
export type { JsonRepository } from './ports/json-repository.ts';
export { previewLayout, applyLayoutProposal } from '../core/domain/layout-proposal.ts';
export { findSubjectOccurrences, linkedArchitectureMap, listArchitectureMaps } from '../core/domain/maps.ts';
export {
  architectureDocumentSchema,
  canvasChangeSetSchema,
  parseArchitectureDocument,
} from './schemas.ts';
export type {
  AppliedCanvasOperation,
  ArchitectureDocument,
  CanvasActor,
  CanvasCapabilityDescription,
  CanvasChangeOutcome,
  CanvasChangeSet,
  CanvasCommand,
  CanvasDiagram,
  CanvasLayout,
  CanvasImportSet,
  CanvasNode,
  CanvasProvenance,
  CanvasReference,
  CanvasWire,
  LayoutProposal,
  LayoutRequest,
  LayoutTarget,
  NodePlacement,
  SourceReference,
  WireRouteHint,
} from './records/legacy.ts';
