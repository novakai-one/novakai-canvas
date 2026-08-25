/** Framework-free public surface shared by the web host, CLI, agents, and future Novakai host. */

// The record capability: independent per-diagram records with one library over them. Hosts
// reach Canvas through this file and never through a path below it.
export { createCanvasLibrary } from './application/canvas-library.ts';
export type {
  CanvasLibrary, CanvasLibraryRepository, DiagramSummary, LibraryFailure, WriteOutcome,
} from './application/canvas-library.ts';
export { createDiagramExportService } from './application/diagram-export-service.ts';
export { exportDiagram, exportDiagrams } from './diagram-export/export-diagrams.ts';
export { DIAGRAM_EXPORT_FORMATS } from './diagram-export/contract.ts';
export type {
  DiagramExportContext, DiagramExportFormat, DiagramExportService,
} from './diagram-export/contract.ts';
export { createCanvasWorkspace } from './application/canvas-workspace.ts';
export type {
  ActorContext, CanvasWorkspace, ChangeOutcome, RecordChangeSet, RecordCommand,
} from './application/canvas-workspace.ts';
export { createMemoryLibraryRepository } from './adapters/memory-library-repository.ts';
export { createFileLibraryRepository } from './adapters/file-library-repository.ts';
export { diagramRecordSchema, libraryIndexSchema } from './domain/record-schema.ts';
export { migrateDocumentToLibrary } from './domain/migrate/v2-to-v3.ts';
export { censusOfLegacyDocument, censusOfMigratedLibrary } from './domain/migrate/census.ts';
export type { CanvasCensus } from './domain/migrate/census.ts';
export type {
  CrossDiagramLink, DiagramRecord, LibraryEntry, LibraryIndex, MigratedLibrary, MigrationReport,
} from './domain/records.ts';
export { resolveNodeAppearance } from './domain/canvas-presentation.ts';
export type {
  AppearanceKey, ContainerArrangement, NodeAppearance, PresentationContext, ResolvedNodeAppearance,
} from './domain/canvas-presentation.ts';
export type {
  DiagramId, LayoutId, LinkId, NodeId, TypeId, ViewId, WireId,
} from './domain/ids.ts';
export { projectView } from './domain/project-view.ts';
export type { PositionedNode, ProjectedView } from './domain/project-view.ts';
export {
  layoutScopes, planWireRoutes, reflowPresentation, routeWire,
} from './domain/diagram-geometry.ts';
export type {
  PlannedWireRoute, Point as GeometryPoint, Rect as GeometryRect, RouteObstacle, RouteSide,
  WireRoute, WireRouteRequest,
} from './domain/diagram-geometry.ts';
export { defaultLayoutOptions } from './domain/layout/contract.ts';
export type {
  LayoutGraph, LayoutOptions, LayoutPlan, LayoutSliceTarget, LayoutStrategy,
} from './domain/layout/contract.ts';
export { graphOfDiagram } from './domain/layout/graph.ts';
export { layoutStrategyFor, planSliceLayout } from './domain/layout/plan.ts';

export { createCanvasEngine, type CanvasEngine } from './application/canvas-engine.ts';
export type { JsonRepository } from './application/json-repository.ts';
export {
  createCanvasObjectStoreRepository,
  type CanvasDocumentRecord,
  type CanvasObjectStore,
} from './adapters/canvas-object-store-repository.ts';
export { previewLayout, applyLayoutProposal } from './domain/layout-proposal.ts';
export { findSubjectOccurrences, linkedArchitectureMap, listArchitectureMaps } from './domain/maps.ts';
export { architectureDocumentSchema, canvasChangeSetSchema } from './domain/schema.ts';
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
} from './domain/model.ts';
